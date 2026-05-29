export default function NotFound() {
	return (
		<div className="wrapper flex flex-col items-center justify-center h-screen text-center text-[#163760]">
			<h1 className="text-5xl md:text-6xl font-medium">404</h1>
			<p className="text-3xl md:text-4xl mb-2">
				Oops, we couldn't find this page
			</p>
			<p className="text-[#6B8791] text-lg md:text-xl">
				Please contact Port & Starboard if this seems like a mistake:{" "}
				<a
					href="mailto:info@portstbd.com"
					className="font-medium text-[#163760] text-lg md:text-xl hover:underline"
				>
					info@portstbd.com
				</a>
			</p>
		</div>
	);
}
