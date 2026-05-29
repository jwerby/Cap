import type { Metadata } from "next";
import { AppsListClient } from "./AppsListClient";

export const metadata: Metadata = {
	title: "Developer Apps — Port & Starboard Watch",
};

export default async function AppsPage() {
	return <AppsListClient />;
}
