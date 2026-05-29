import { describe, expect, it } from "vitest";
import {
	getActiveCaptionText,
	getCaptionTextAtTime,
} from "@/app/s/[videoId]/_components/caption-cues";

function createCueList(
	cues: { endTime?: number; startTime: number; text: string }[],
): TextTrackCueList {
	return {
		length: cues.length,
		item: (index: number) => cues[index] ?? null,
		getCueById: () => null,
	} as unknown as TextTrackCueList;
}

describe("getActiveCaptionText", () => {
	it("returns an empty caption when no cue is active", () => {
		expect(getActiveCaptionText(null)).toBe("");
		expect(getActiveCaptionText(createCueList([]))).toBe("");
	});

	it("uses the latest active cue when cues overlap", () => {
		const activeCues = createCueList([
			{ startTime: 0, text: "First caption" },
			{ startTime: 3.199, text: "<v Speaker>Second caption</v>" },
		]);

		expect(getActiveCaptionText(activeCues)).toBe("Second caption");
	});
});

describe("getCaptionTextAtTime", () => {
	it("uses cue timing when browser active cues lag", () => {
		const cues = createCueList([
			{ startTime: 0.96, endTime: 2.84, text: "First caption" },
			{
				startTime: 2.84,
				endTime: 5.32,
				text: "<v Speaker>Current caption</v>",
			},
			{ startTime: 5.32, endTime: 7.12, text: "Later caption" },
		]);

		expect(getCaptionTextAtTime(cues, 3.1)).toBe("Current caption");
	});

	it("returns an empty caption outside cue ranges", () => {
		const cues = createCueList([
			{ startTime: 1, endTime: 2, text: "First caption" },
		]);

		expect(getCaptionTextAtTime(cues, 0.5)).toBe("");
	});
});
