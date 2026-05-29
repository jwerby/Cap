import type { Metadata } from "next";
import { AppSettingsClient } from "./AppSettingsClient";

export const metadata: Metadata = {
	title: "App Settings — Port & Starboard Watch",
};

export default async function AppSettingsPage() {
	return <AppSettingsClient />;
}
