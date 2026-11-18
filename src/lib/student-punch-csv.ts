export interface StudentPunch {
	id: number;
	type: string;
	timestamp: Date | string;
	notes: string | null;
}

interface StudentPunchCsvOptions {
	punches: StudentPunch[];
	studentName: string;
	studentEmail: string;
	boardName: string;
	startDate?: string;
}

const getLocalDateKey = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const protectSpreadsheetCell = (value: string) => {
	return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
};

const escapeCsvCell = (value: string | number) => {
	const safeValue = protectSpreadsheetCell(String(value));
	return `"${safeValue.replace(/"/g, '""')}"`;
};

export const calculateOutPunchDurations = (punchList: StudentPunch[]) => {
	const sorted = [...punchList].sort(
		(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
	);
	const durationMap = new Map<number, number>();
	let lastInTime: Date | null = null;

	for (const punch of sorted) {
		if (punch.type === "in") {
			lastInTime = new Date(punch.timestamp);
		} else if (punch.type === "out" && lastInTime) {
			const durationHours =
				(new Date(punch.timestamp).getTime() - lastInTime.getTime()) /
				(1000 * 60 * 60);
			durationMap.set(punch.id, durationHours);
			lastInTime = null;
		}
	}

	return durationMap;
};

export const filterPunchesFromDate = (
	punchList: StudentPunch[],
	startDate?: string,
) => {
	if (!startDate) return punchList;

	return punchList.filter(
		(punch) => getLocalDateKey(new Date(punch.timestamp)) >= startDate,
	);
};

export const buildStudentPunchCsv = ({
	punches,
	studentName,
	studentEmail,
	boardName,
	startDate,
}: StudentPunchCsvOptions) => {
	const durations = calculateOutPunchDurations(punches);
	const includedPunches = filterPunchesFromDate(punches, startDate).sort(
		(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
	);
	const rows: Array<Array<string | number>> = [
		[
			"Name",
			"Email",
			"Board",
			"Date",
			"Time",
			"Type",
			"Duration Hours",
			"Notes",
		],
	];

	for (const punch of includedPunches) {
		const timestamp = new Date(punch.timestamp);
		const duration = durations.get(punch.id);

		rows.push([
			studentName,
			studentEmail,
			boardName,
			timestamp.toLocaleDateString("en-US"),
			timestamp.toLocaleTimeString("en-US", {
				hour: "numeric",
				minute: "2-digit",
				second: "2-digit",
			}),
			punch.type.toUpperCase(),
			duration === undefined ? "" : duration.toFixed(2),
			punch.notes ?? "",
		]);
	}

	return `\uFEFF${rows
		.map((row) => row.map(escapeCsvCell).join(","))
		.join("\r\n")}`;
};

const slugifyFilenamePart = (value: string) => {
	return (
		value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "") || "member"
	);
};

export const getStudentPunchCsvFilename = (
	studentName: string,
	startDate?: string,
) => {
	const range = startDate ? `from-${startDate}` : "all-time";
	return `${slugifyFilenamePart(studentName)}-punches-${range}.csv`;
};
