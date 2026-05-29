import type { Metadata } from "next";
import { DomainsClient } from "./DomainsClient";

export const metadata: Metadata = {
	title: "Allowed Domains — Port & Starboard Watch",
};

export default async function DomainsPage() {
	return <DomainsClient />;
}
