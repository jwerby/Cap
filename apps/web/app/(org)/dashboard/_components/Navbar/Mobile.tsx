"use client";

import { useClickAway } from "@uidotdev/usehooks";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import Link from "next/link";
import { type MutableRefObject, useState } from "react";
import { PortstbdLogo, PortstbdMark } from "@/components/PortstbdAuthLogo";

import { ThemeToggleIcon } from "@/components/theme-toggle-icon";
import { useTheme } from "../../Contexts";
import NavItems from "./Items";

export const AdminMobileNav = () => {
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const sidebarRef: MutableRefObject<HTMLDivElement> = useClickAway(() =>
		setSidebarOpen(false),
	);
	const { theme, setThemeHandler } = useTheme();
	return (
		<>
			<AnimatePresence>
				{sidebarOpen ? (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0, display: "none" }}
						className="flex fixed inset-0 z-[60] lg:hidden bg-gray-1/50"
					>
						<motion.div
							ref={sidebarRef}
							initial={{ x: "100%" }}
							animate={{
								x: 0,
								transition: { duration: 0.3, bounce: 0.2, type: "spring" },
							}}
							exit={{ x: "100%" }}
							className="relative flex-1 flex flex-col ml-auto max-w-xs w-[285px] border-l border-[#D8E7EB] pt-5 pb-4 px-4 bg-[linear-gradient(180deg,#F7FBFC_0%,#EDF5F7_100%)]"
						>
							<div className="flex justify-between items-center mb-6 w-full">
								<PortstbdLogo className="h-8 w-auto max-w-[178px]" />
								<button
									type="button"
									className="grid place-items-center rounded-full border border-[#D8E7EB] bg-white/70 size-9 text-[#163760]"
									onClick={() => setSidebarOpen(false)}
								>
									<X className="size-5" aria-hidden="true" />
								</button>
							</div>
							<NavItems toggleMobileNav={() => setSidebarOpen(false)} />
						</motion.div>
					</motion.div>
				) : null}
			</AnimatePresence>
			<div className="flex fixed z-[51] justify-between w-full h-16 border-b border-[#D8E7EB] bg-[#F7FBFC]/95 backdrop-blur lg:border-none lg:hidden">
				<div className="flex flex-shrink-0 items-center px-4 h-full lg:hidden">
					<Link className="block" href="/dashboard">
						<PortstbdMark className="size-9" />
					</Link>
				</div>
				<div className="flex gap-4 items-center px-4 h-full">
					<button
						type="button"
						onClick={() => {
							setThemeHandler(theme === "light" ? "dark" : "light");
						}}
						aria-label="Toggle theme"
						className="flex justify-center items-center rounded-full border transition-colors cursor-pointer lg:hidden bg-white/70 hover:border-[#63A1B4] hover:bg-white size-9 border-[#D8E7EB] text-[#163760]"
					>
						<ThemeToggleIcon />
					</button>
				</div>
			</div>
		</>
	);
};

export default AdminMobileNav;
