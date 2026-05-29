import type { Metadata } from "next";
import { ImportPage } from "./ImportPage";

export const metadata: Metadata = {
	title: "Import — Port & Starboard Watch",
};

export default function Page() {
	return <ImportPage />;
}
