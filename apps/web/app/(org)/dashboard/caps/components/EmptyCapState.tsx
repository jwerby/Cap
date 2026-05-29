import { Button } from "@cap/ui";
import { faVideo } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRive } from "@rive-app/react-canvas";
import { useTheme } from "../../Contexts";
import { UploadCapButton } from "./UploadCapButton";
import { WebRecorderDialog } from "./web-recorder-dialog/web-recorder-dialog";

interface EmptyCapStateProps {
	userName?: string;
}

export const EmptyCapState: React.FC<EmptyCapStateProps> = ({ userName }) => {
	const { theme } = useTheme();
	const { RiveComponent: EmptyCap } = useRive({
		src: "/rive/main.riv",
		artboard: theme === "light" ? "empty" : "darkempty",
		autoplay: true,
	});
	return (
		<div className="flex flex-col flex-1 justify-center items-center w-full h-full">
			<div className="flex flex-col gap-3 justify-center items-center h-full text-center rounded-[28px] border border-[#D8E7EB] bg-white/55 px-6 py-10 shadow-[0_28px_80px_-60px_#163760]">
				<div className="mx-auto w-full mb-10 max-w-[450px] flex justify-center items-center">
					<EmptyCap key={`${theme}empty-cap`} className="h-[150px] w-[400px]" />
				</div>
				<div className="flex flex-col items-center px-5">
					<p className="mb-1 text-xl font-bold text-[#163760]">
						Hey{userName ? ` ${userName}` : ""}! Record your first video
					</p>
					<p className="max-w-md text-[#3C7486] text-md">
						Capture client walkthroughs, demos, and handoffs in Port & Starboard
						Watch.
					</p>
				</div>
				<div className="flex flex-wrap gap-3 justify-center items-center mt-4">
					<Button
						href="/dashboard/caps/record"
						className="flex relative gap-2 justify-center items-center"
						variant="primary"
					>
						<FontAwesomeIcon className="size-3.5" icon={faVideo} />
						Open Recorder
					</Button>
					<p className="text-sm text-gray-10">or</p>
					<WebRecorderDialog />
					<p className="text-sm text-gray-10">or</p>
					<UploadCapButton />
				</div>
			</div>
		</div>
	);
};
