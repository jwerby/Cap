import type { Metadata } from "next";
import { ImportFilePage } from "./ImportFilePage";

export const metadata: Metadata = {
	title: "Upload File — Port & Starboard Watch",
};

export default function Page() {
	return <ImportFilePage />;
}
