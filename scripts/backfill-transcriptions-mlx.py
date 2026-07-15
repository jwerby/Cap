#!/usr/bin/env python3
import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

import boto3
import mlx.core as mx
import mlx_whisper
import pymysql


DEFAULT_OWNER_ID = "538d4bd0593b11f"
DEFAULT_ORG_ID = "hqem1fz7g23nqae"
DEFAULT_BUCKET = "portstbd-watch-production"
DEFAULT_REGION = "us-east-1"
DEFAULT_MODEL = "mlx-community/whisper-large-v3-turbo"
SECRET_ID = "portstbd-watch/production"


def parse_args():
	parser = argparse.ArgumentParser()
	parser.add_argument("--apply", action="store_true")
	parser.add_argument("--force", action="store_true")
	parser.add_argument("--keep-files", action="store_true")
	parser.add_argument("--limit", type=int)
	parser.add_argument("--video-id", action="append", default=[])
	parser.add_argument("--owner-id", default=DEFAULT_OWNER_ID)
	parser.add_argument("--org-id", default=DEFAULT_ORG_ID)
	parser.add_argument("--bucket", default=DEFAULT_BUCKET)
	parser.add_argument("--region", default=DEFAULT_REGION)
	parser.add_argument("--model", default=os.environ.get("CAP_MLX_WHISPER_MODEL", DEFAULT_MODEL))
	parser.add_argument("--language", default=os.environ.get("CAP_TRANSCRIPTION_LANGUAGE"))
	parser.add_argument("--work-dir", default="tmp/transcription-backfill")
	parser.add_argument("--no-word-timestamps", action="store_true")
	return parser.parse_args()


def get_secret(region):
	client = boto3.client("secretsmanager", region_name=region)
	return json.loads(client.get_secret_value(SecretId=SECRET_ID)["SecretString"])


def db_config(secret):
	url = urlparse(secret["DATABASE_URL"])
	return {
		"host": "127.0.0.1",
		"port": 13306,
		"user": unquote(url.username or ""),
		"password": unquote(url.password or ""),
		"database": url.path.lstrip("/"),
		"cursorclass": pymysql.cursors.DictCursor,
		"autocommit": True,
		"connect_timeout": 10,
		"read_timeout": 60,
		"write_timeout": 60,
	}


def db_query(config, sql, params=None):
	with pymysql.connect(**config) as conn:
		with conn.cursor() as cursor:
			cursor.execute(sql, params or [])
			return cursor.fetchall()


def db_execute(config, sql, params=None):
	with pymysql.connect(**config) as conn:
		with conn.cursor() as cursor:
			cursor.execute(sql, params or [])


def load_videos(config, args):
	params = [args.owner_id, args.org_id]
	where = ["ownerId = %s", "orgId = %s"]
	if args.video_id:
		where.append(f"id in ({','.join(['%s'] * len(args.video_id))})")
		params.extend(args.video_id)
	elif not args.force:
		where.append(
			"(transcriptionStatus is null or transcriptionStatus in ('ERROR', 'PROCESSING'))"
		)
	limit = ""
	if args.limit:
		limit = " limit %s"
		params.append(args.limit)
	return db_query(
		config,
		f"select id, ownerId, orgId, name, duration, transcriptionStatus from videos where {' and '.join(where)} order by createdAt, id{limit}",
		params,
	)


def has_object(s3, bucket, key):
	try:
		s3.head_object(Bucket=bucket, Key=key)
		return True
	except s3.exceptions.ClientError as error:
		status = error.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
		if status == 404:
			return False
		raise


def download_video(s3, bucket, key, output_path):
	output_path.parent.mkdir(parents=True, exist_ok=True)
	s3.download_file(bucket, key, str(output_path))


def has_audio(video_path):
	result = subprocess.run(
		[
			"ffprobe",
			"-v",
			"error",
			"-select_streams",
			"a:0",
			"-show_entries",
			"stream=codec_type",
			"-of",
			"csv=p=0",
			str(video_path),
		],
		text=True,
		stdout=subprocess.PIPE,
		stderr=subprocess.PIPE,
		check=False,
	)
	return result.returncode == 0 and "audio" in result.stdout


def extract_audio(video_path, audio_path):
	audio_path.parent.mkdir(parents=True, exist_ok=True)
	subprocess.run(
		[
			"ffmpeg",
			"-hide_banner",
			"-loglevel",
			"error",
			"-y",
			"-i",
			str(video_path),
			"-vn",
			"-ac",
			"1",
			"-ar",
			"16000",
			"-f",
			"wav",
			str(audio_path),
		],
		check=True,
	)


def format_timestamp(seconds):
	millis = max(0, int(round(float(seconds) * 1000)))
	hours = millis // 3_600_000
	millis %= 3_600_000
	minutes = millis // 60_000
	millis %= 60_000
	secs = millis // 1000
	millis %= 1000
	return f"{hours:02}:{minutes:02}:{secs:02}.{millis:03}"


def clean_text(text):
	return " ".join(str(text or "").replace("\n", " ").split())


def word_text(word):
	return clean_text(word.get("word") or word.get("text") or "")


def cues_from_words(words):
	cues = []
	group = []
	start = None
	last_end = None
	for index, word in enumerate(words):
		text = word_text(word)
		if not text:
			continue
		word_start = float(word.get("start", last_end or 0))
		word_end = float(word.get("end", word_start))
		if start is None:
			start = word_start
		group.append(text)
		next_word = words[index + 1] if index + 1 < len(words) else None
		next_start = float(next_word.get("start", word_end)) if next_word else None
		should_break = (
			text.endswith((",", ".", "!", "?"))
			or len(group) >= 8
			or (next_start is not None and next_start - word_end > 0.5)
		)
		if should_break and start is not None:
			cues.append((start, max(word_end, start + 0.1), " ".join(group)))
			group = []
			start = None
		last_end = word_end
	if group and start is not None:
		cues.append((start, max(last_end or start, start + 0.1), " ".join(group)))
	return cues


def result_to_vtt(result):
	cues = []
	for segment in result.get("segments", []):
		words = segment.get("words") or []
		if words:
			cues.extend(cues_from_words(words))
		else:
			text = clean_text(segment.get("text"))
			if text:
				start = float(segment.get("start", 0))
				end = float(segment.get("end", start + 0.1))
				cues.append((start, max(end, start + 0.1), text))
	lines = ["WEBVTT", ""]
	for index, (start, end, text) in enumerate(cues, start=1):
		lines.extend([str(index), f"{format_timestamp(start)} --> {format_timestamp(end)}", text, ""])
	return "\n".join(lines), len(cues)


def transcribe(audio_path, args):
	options = {
		"path_or_hf_repo": args.model,
		"verbose": None,
		"word_timestamps": not args.no_word_timestamps,
	}
	if args.language:
		options["language"] = args.language
	return mlx_whisper.transcribe(str(audio_path), **options)


def write_progress(path, payload):
	path.parent.mkdir(parents=True, exist_ok=True)
	with path.open("a", encoding="utf8") as file:
		file.write(json.dumps(payload, sort_keys=True) + "\n")


def set_status(config, video_id, status):
	db_execute(
		config,
		"update videos set transcriptionStatus = %s where id = %s",
		[status, video_id],
	)


def process_video(video, args, config, s3, progress_path):
	video_id = video["id"]
	owner_id = video["ownerId"]
	video_key = f"{owner_id}/{video_id}/result.mp4"
	transcript_key = f"{owner_id}/{video_id}/transcription.vtt"
	video_dir = Path(args.work_dir) / video_id
	video_path = video_dir / "result.mp4"
	audio_path = video_dir / "audio.wav"
	started = time.time()

	if has_object(s3, args.bucket, transcript_key) and not args.force:
		if args.apply:
			set_status(config, video_id, "COMPLETE")
		return {"videoId": video_id, "status": "already_uploaded", "seconds": 0}

	if not args.apply:
		return {"videoId": video_id, "status": "pending", "seconds": 0}

	set_status(config, video_id, "PROCESSING")
	download_video(s3, args.bucket, video_key, video_path)
	if not has_audio(video_path):
		set_status(config, video_id, "NO_AUDIO")
		if not args.keep_files:
			shutil.rmtree(video_dir, ignore_errors=True)
		return {"videoId": video_id, "status": "no_audio", "seconds": round(time.time() - started, 2)}

	extract_audio(video_path, audio_path)
	result = transcribe(audio_path, args)
	vtt, cue_count = result_to_vtt(result)
	if cue_count == 0:
		set_status(config, video_id, "NO_AUDIO")
		if not args.keep_files:
			shutil.rmtree(video_dir, ignore_errors=True)
		return {"videoId": video_id, "status": "no_speech", "seconds": round(time.time() - started, 2)}

	s3.put_object(
		Bucket=args.bucket,
		Key=transcript_key,
		Body=vtt.encode("utf8"),
		ContentType="text/vtt; charset=utf-8",
	)
	set_status(config, video_id, "COMPLETE")
	if not args.keep_files:
		shutil.rmtree(video_dir, ignore_errors=True)
	return {
		"videoId": video_id,
		"status": "complete",
		"cues": cue_count,
		"language": result.get("language"),
		"seconds": round(time.time() - started, 2),
	}


def main():
	args = parse_args()
	if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
		print("ffmpeg and ffprobe are required", file=sys.stderr)
		return 1
	secret = get_secret(args.region)
	config = db_config(secret)
	s3 = boto3.client("s3", region_name=args.region)
	videos = load_videos(config, args)
	progress_path = Path(args.work_dir) / "results.jsonl"
	print(
		json.dumps(
			{
				"mode": "apply" if args.apply else "dry-run",
				"device": str(mx.default_device()),
				"model": args.model,
				"wordTimestamps": not args.no_word_timestamps,
				"videos": len(videos),
			},
			sort_keys=True,
		)
	)
	for index, video in enumerate(videos, start=1):
		payload = {
			"at": datetime.now(timezone.utc).isoformat(),
			"index": index,
			"total": len(videos),
			"videoId": video["id"],
			"name": video["name"],
			"duration": video["duration"],
		}
		try:
			result = process_video(video, args, config, s3, progress_path)
			payload.update(result)
		except Exception as error:
			payload.update({"status": "error", "error": str(error)})
			if args.apply:
				set_status(config, video["id"], "ERROR")
		print(json.dumps(payload, sort_keys=True), flush=True)
		write_progress(progress_path, payload)
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
