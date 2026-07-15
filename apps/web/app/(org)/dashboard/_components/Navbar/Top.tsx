"use client";

import { buildEnv } from "@cap/env";
import {
	Command,
	CommandGroup,
	CommandItem,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@cap/ui";
import { isCapDeployment } from "@cap/utils";
import { faBell } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useClickAway } from "@uidotdev/usehooks";
import clsx from "clsx";
import { AnimatePresence } from "framer-motion";
import { MoreVertical } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
	cloneElement,
	type MutableRefObject,
	memo,
	type RefObject,
	useMemo,
	useRef,
	useState,
} from "react";
import { markAsRead } from "@/actions/notifications/mark-as-read";
import Notifications from "@/app/(org)/dashboard/_components/Notifications";
import { SignedImageUrl } from "@/components/SignedImageUrl";
import { ThemeToggleIcon } from "@/components/theme-toggle-icon";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useDashboardContext, useTheme } from "../../Contexts";
import {
	ArrowUpIcon,
	DownloadIcon,
	HomeIcon,
	LogoutIcon,
	MessageCircleMoreIcon,
	ReferIcon,
	SettingsGearIcon,
} from "../AnimatedIcons";
import type { DownloadIconHandle } from "../AnimatedIcons/Download";
import type { ReferIconHandle } from "../AnimatedIcons/Refer";

const Top = () => {
	const capDeployment = isCapDeployment(buildEnv.NEXT_PUBLIC_IS_CAP);
	const { activeSpace, anyNewNotifications, isDeveloperSection } =
		useDashboardContext();
	const [toggleNotifications, setToggleNotifications] = useState(false);
	const bellRef = useRef<HTMLButtonElement>(null);
	const { theme, setThemeHandler } = useTheme();
	const queryClient = useQueryClient();

	const pathname = usePathname();
	const params = useParams();

	const titles: Record<string, string> = {
		"/dashboard/caps": "Recordings",
		"/dashboard/folder": "Recordings",
		"/dashboard/shared-caps": "Shared Recordings",
		"/dashboard/caps/record": "Record Video",
		"/dashboard/settings/organization": "Organization Settings",
		"/dashboard/settings/organization/preferences": "Organization Settings",
		"/dashboard/settings/organization/billing": "Organization Settings",
		"/dashboard/settings/organization/members": "Organization Settings",
		"/dashboard/settings/account": "Account Settings",
		"/dashboard/spaces": "Spaces",
		"/dashboard/spaces/browse": "Browse Spaces",
		"/dashboard/analytics": "Analytics",
		[`/dashboard/folder/${params.id}`]: "Recordings",
		[`/dashboard/analytics/s/${params.id}`]: "Analytics: Recording",
		"/dashboard/developers": "Developers",
		"/dashboard/developers/apps": "Developer Apps",
		"/dashboard/developers/usage": "Developer Usage",
		"/dashboard/developers/credits": "Developer Credits",
	};

	const title = activeSpace ? activeSpace.name : titles[pathname] || "";

	const notificationsRef: MutableRefObject<HTMLDivElement> = useClickAway(
		(e) => {
			if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
				setToggleNotifications(false);
			}
		},
	);

	const markAllAsread = useMutation({
		mutationFn: () => markAsRead(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["notifications"],
			});
		},
		onError: (error) => {
			console.error("Error marking notifications as read:", error);
		},
	});

	return (
		<div
			className={clsx(
				"flex fixed z-40 justify-between items-center py-3 pr-2 pl-5 w-full md:relative mt-[60px] lg:mt-0 lg:py-[19px] lg:pl-0 lg:pr-5",
				"top-0 border-b border-[#D8E7EB]/80 bg-[#F7FBFC]/95 backdrop-blur lg:border-b-0 dark:border-gray-3 dark:bg-gray-1 dark:text-gray-12",
			)}
		>
			<div className="flex flex-col gap-0.5">
				{activeSpace && <span className="text-xs text-gray-11">Space</span>}
				<div className="flex gap-1.5 items-center">
					{activeSpace && (
						<SignedImageUrl
							image={activeSpace.iconUrl}
							name={activeSpace?.name}
							letterClass="text-xs"
							className="relative flex-shrink-0 size-5"
						/>
					)}
					<p className="relative text-lg font-bold truncate text-[#163760] lg:text-2xl dark:text-gray-12">
						{title}
					</p>
				</div>
			</div>
			<div className="flex gap-4 items-center">
				{capDeployment && <ReferButton />}
				<button
					type="button"
					data-state={toggleNotifications ? "open" : "closed"}
					ref={bellRef}
					onClick={() => {
						if (anyNewNotifications) {
							markAllAsread.mutate();
						}
						setToggleNotifications(!toggleNotifications);
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							if (anyNewNotifications) {
								markAllAsread.mutate();
							}
							setToggleNotifications(!toggleNotifications);
						}
					}}
					aria-label={`Notifications${
						anyNewNotifications ? " (new notifications available)" : ""
					}`}
					aria-expanded={toggleNotifications}
					className="hidden relative justify-center data-[state=open]:hover:bg-[#D8E7EB] items-center bg-[#EDF5F7]
                rounded-full transition-colors cursor-pointer lg:flex
                hover:bg-[#D8E7EB] data-[state=open]:bg-[#D8E7EB]
                focus:outline-none
					size-9 dark:bg-gray-3 dark:hover:bg-gray-4 dark:data-[state=open]:bg-gray-4 dark:data-[state=open]:hover:bg-gray-4"
				>
					{anyNewNotifications && (
						<div className="absolute right-0 top-1 z-10">
							<div className="relative">
								<div className="absolute inset-0 w-2 h-2 bg-red-400 rounded-full opacity-75 animate-ping" />
								<div className="relative w-2 h-2 bg-red-400 rounded-full" />
							</div>
						</div>
					)}
					<FontAwesomeIcon
						className="text-[#163760] size-3.5 dark:text-gray-12"
						icon={faBell}
					/>
					<AnimatePresence>
						{toggleNotifications && <Notifications ref={notificationsRef} />}
					</AnimatePresence>
				</button>
				{!isDeveloperSection && (
					<button
						type="button"
						onClick={() => {
							if (document.startViewTransition) {
								document.startViewTransition(() => {
									setThemeHandler(theme === "light" ? "dark" : "light");
								});
							} else {
								setThemeHandler(theme === "light" ? "dark" : "light");
							}
						}}
						aria-label="Toggle theme"
						className="hidden justify-center items-center rounded-full transition-colors cursor-pointer bg-[#EDF5F7] lg:flex hover:bg-[#D8E7EB] size-9 text-[#163760] dark:bg-gray-3 dark:text-gray-12 dark:hover:bg-gray-4"
					>
						<ThemeToggleIcon />
					</button>
				)}
				<User />
			</div>
		</div>
	);
};

const User = () => {
	const capDeployment = isCapDeployment(buildEnv.NEXT_PUBLIC_IS_CAP);
	const [menuOpen, setMenuOpen] = useState(false);
	const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
	const { user } = useDashboardContext();

	const menuItems = useMemo(
		() => [
			{
				name: "Watch Home",
				icon: <HomeIcon />,
				href: "/home",
				onClick: () => setMenuOpen(false),
				iconClassName: "text-gray-11 group-hover:text-gray-12",
				showCondition: capDeployment,
			},
			{
				name: "Upgrade to Pro",
				icon: <ArrowUpIcon />,
				onClick: () => {
					setMenuOpen(false);
					setUpgradeModalOpen(true);
				},
				iconClassName: "text-amber-400 group-hover:text-amber-500",
				showCondition: capDeployment && !user.isPro,
			},
			{
				name: "Earn 40% Referral",
				icon: <ReferIcon />,
				href: "/dashboard/refer",
				onClick: () => setMenuOpen(false),
				iconClassName: "text-gray-11 group-hover:text-gray-12",
				showCondition: capDeployment,
			},
			{
				name: "Settings",
				icon: <SettingsGearIcon />,
				href: "/dashboard/settings/account",
				onClick: () => setMenuOpen(false),
				iconClassName: "text-gray-11 group-hover:text-gray-12",
				showCondition: true,
			},
			{
				name: "Chat Support",
				icon: <MessageCircleMoreIcon />,
				onClick: () => window.open("https://cap.link/discord", "_blank"),
				iconClassName: "text-gray-11 group-hover:text-gray-12",
				showCondition: capDeployment,
			},
			{
				name: "Record Video",
				icon: <DownloadIcon />,
				href: "/dashboard/caps/record",
				onClick: () => setMenuOpen(false),
				iconClassName: "text-gray-11 group-hover:text-gray-12",
				showCondition: true,
			},
			{
				name: "Sign Out",
				icon: <LogoutIcon />,
				onClick: () => signOut(),
				iconClassName: "text-gray-11 group-hover:text-gray-12",
				showCondition: true,
			},
		],
		[capDeployment, user.isPro],
	);

	return (
		<>
			<UpgradeModal
				open={upgradeModalOpen}
				onOpenChange={setUpgradeModalOpen}
			/>
			<Popover open={menuOpen} onOpenChange={setMenuOpen}>
				<PopoverTrigger asChild>
					<div
						data-state={menuOpen ? "open" : "closed"}
						className="flex gap-2 justify-between  items-center p-2 rounded-xl border data-[state=open]:border-gray-3 data-[state=open]:bg-gray-3 border-transparent transition-colors cursor-pointer group lg:gap-6 hover:border-gray-3"
					>
						<div className="flex items-center">
							<SignedImageUrl
								image={user.imageUrl}
								name={user.name ?? "User"}
								letterClass="text-xs lg:text-md"
								className="flex-shrink-0 size-[24px] text-gray-12"
							/>
							<span className="ml-2 text-sm truncate lg:ml-2 lg:text-md text-gray-12">
								{user.name ?? "User"}
							</span>
						</div>
						<MoreVertical
							data-state={menuOpen ? "open" : "closed"}
							className="w-5 h-5 data-[state=open]:text-gray-12 transition-colors text-gray-10 group-hover:text-gray-12"
						/>
					</div>
				</PopoverTrigger>
				<PopoverContent className="p-1 w-48">
					<Command>
						<CommandGroup>
							{menuItems
								.filter((item) => item.showCondition)
								.map((item, index) => (
									<MenuItem
										key={index.toString()}
										icon={item.icon}
										name={item.name}
										href={item.href ?? "#"}
										onClick={item.onClick}
										iconClassName={item.iconClassName}
									/>
								))}
						</CommandGroup>
					</Command>
				</PopoverContent>
			</Popover>
		</>
	);
};

interface Props {
	icon: React.ReactElement<{
		ref: RefObject<DownloadIconHandle | null>;
		className: string;
		size: number;
	}>;
	name: string;
	href?: string;
	onClick: () => void;
	iconClassName?: string;
}

const MenuItem = memo(({ icon, name, href, onClick, iconClassName }: Props) => {
	const iconRef = useRef<DownloadIconHandle>(null);
	return (
		<CommandItem
			key={name}
			className="px-2 py-1.5 rounded-lg transition-colors duration-300 cursor-pointer hover:bg-gray-5 group"
			onSelect={onClick}
			onMouseEnter={() => {
				iconRef.current?.startAnimation();
			}}
			onMouseLeave={() => {
				iconRef.current?.stopAnimation();
			}}
		>
			<Link
				className="flex gap-2 items-center w-full"
				href={href ?? "#"}
				prefetch={true}
				onClick={onClick}
			>
				<div className="flex-shrink-0 flex items-center justify-center w-3.5 h-3.5">
					{cloneElement(icon, {
						ref: iconRef,
						className: iconClassName,
						size: 14,
					})}
				</div>
				<p className={clsx("text-sm text-gray-12")}>{name}</p>
			</Link>
		</CommandItem>
	);
});

const ReferButton = () => {
	const iconRef = useRef<ReferIconHandle>(null);
	const { setReferClickedStateHandler, referClickedState } =
		useDashboardContext();

	return (
		<Link
			href="/dashboard/refer"
			className="hidden relative lg:block"
			onClick={() => {
				setReferClickedStateHandler(true);
			}}
			onMouseEnter={() => {
				iconRef.current?.startAnimation();
			}}
			onMouseLeave={() => {
				iconRef.current?.stopAnimation();
			}}
		>
			{!referClickedState && (
				<div className="absolute right-0 top-1 z-10">
					<div className="relative">
						<div className="absolute inset-0 w-2 h-2 bg-red-400 rounded-full opacity-75 animate-ping" />
						<div className="relative w-2 h-2 bg-red-400 rounded-full" />
					</div>
				</div>
			)}

			<div className="flex justify-center items-center rounded-full transition-colors cursor-pointer bg-gray-3 hover:bg-gray-5 size-9">
				{cloneElement(<ReferIcon />, {
					ref: iconRef,
					className: "text-gray-12 size-3.5",
				})}
			</div>
		</Link>
	);
};

export default Top;
