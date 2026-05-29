function getCueAt(cues: TextTrackCueList, index: number): TextTrackCue | null {
	const cueList = cues as TextTrackCueList & {
		item?: (index: number) => TextTrackCue | null;
	};

	return cueList[index] ?? cueList.item?.(index) ?? null;
}

function getCueText(cue: TextTrackCue | null): string {
	if (!cue || !("text" in cue) || typeof cue.text !== "string") {
		return "";
	}

	return cue.text.replace(/<[^>]*>/g, "");
}

export function getActiveCaptionText(
	activeCues: TextTrackCueList | null | undefined,
): string {
	if (!activeCues?.length) {
		return "";
	}

	let selectedCue: TextTrackCue | null = null;

	for (let index = 0; index < activeCues.length; index++) {
		const cue = getCueAt(activeCues, index);
		if (cue && (!selectedCue || cue.startTime >= selectedCue.startTime)) {
			selectedCue = cue;
		}
	}

	return getCueText(selectedCue);
}

export function getCaptionTextAtTime(
	cues: TextTrackCueList | null | undefined,
	currentTime: number,
): string {
	if (!cues?.length) {
		return "";
	}

	let selectedCue: TextTrackCue | null = null;

	for (let index = 0; index < cues.length; index++) {
		const cue = getCueAt(cues, index);
		if (
			cue &&
			cue.startTime <= currentTime &&
			currentTime < cue.endTime &&
			(!selectedCue || cue.startTime >= selectedCue.startTime)
		) {
			selectedCue = cue;
		}
	}

	return getCueText(selectedCue);
}
