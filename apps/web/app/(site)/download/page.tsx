import { buildEnv } from "@cap/env";
import { isCapDeployment } from "@cap/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DownloadPage } from "@/components/pages/DownloadPage";

export const metadata: Metadata = {
	title: "Download — Cap",
};

export default function App() {
	if (!isCapDeployment(buildEnv.NEXT_PUBLIC_IS_CAP)) notFound();

	return <DownloadPage />;
}
