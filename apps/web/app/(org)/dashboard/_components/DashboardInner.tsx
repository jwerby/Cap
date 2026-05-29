"use client";
import Top from "./Navbar/Top";

export default function DashboardInner({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="flex overflow-hidden w-full flex-col flex-1 md:mt-0 mt-[126px]">
			<Top />
			<main
				className={
					"flex relative flex-col flex-1 h-full [grid-area:main] bg-[#F7FBFC]"
				}
			>
				<div
					aria-hidden
					className="h-0 rounded-tl-2xl border border-b-0 pointer-events-none lg:h-2 bg-[#EDF5F7] border-[#D8E7EB]"
				/>
				<div className="flex overflow-hidden overflow-y-auto overscroll-contain flex-col flex-1 p-5 h-full border border-t-0 bg-[linear-gradient(180deg,#EDF5F7_0%,#F7FBFC_42%,#F7FBFC_100%)] border-[#D8E7EB] lg:p-8 relative">
					<div className="flex flex-col flex-1 gap-4 min-h-fit">{children}</div>
				</div>
			</main>
		</div>
	);
}
