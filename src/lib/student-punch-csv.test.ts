import { describe, expect, it } from "vitest";
import {
	buildStudentPunchCsv,
	filterPunchesFromDate,
	getStudentPunchCsvFilename,
} from "./student-punch-csv";

const localTimestamp = (
	year: number,
	month: number,
	day: number,
	hour: number,
) => new Date(year, month - 1, day, hour).toISOString();

describe("student punch CSV", () => {
	it("includes punches on and after the selected local start date", () => {
		const punches = [
			{
				id: 1,
				type: "in",
				timestamp: localTimestamp(2026, 2, 1, 23),
				notes: null,
			},
			{
				id: 2,
				type: "out",
				timestamp: localTimestamp(2026, 2, 2, 9),
				notes: null,
			},
		];

		expect(filterPunchesFromDate(punches, "2026-02-02")).toEqual([punches[1]]);
	});

	it("sorts chronologically, calculates durations, and safely escapes values", () => {
		const csv = buildStudentPunchCsv({
			studentName: 'Alex "AJ" Doe',
			studentEmail: "alex@example.com",
			boardName: "Main, Floor",
			punches: [
				{
					id: 2,
					type: "out",
					timestamp: localTimestamp(2026, 2, 2, 17),
					notes: "=1+1",
				},
				{
					id: 1,
					type: "in",
					timestamp: localTimestamp(2026, 2, 2, 9),
					notes: 'Ready, "set"',
				},
			],
		});
		const lines = csv.slice(1).split("\r\n");

		expect(lines).toHaveLength(3);
		expect(lines[1]).toContain('"Alex ""AJ"" Doe"');
		expect(lines[1]).toContain('"Main, Floor"');
		expect(lines[1]).toContain('"Ready, ""set"""');
		expect(lines[2]).toContain('"OUT","8.00","\'=1+1"');
	});

	it("creates a filesystem-safe filename for the selected range", () => {
		expect(getStudentPunchCsvFilename("Alex / Doe", "2026-02-02")).toBe(
			"alex-doe-punches-from-2026-02-02.csv",
		);
		expect(getStudentPunchCsvFilename("Alex Doe")).toBe(
			"alex-doe-punches-all-time.csv",
		);
	});
});
