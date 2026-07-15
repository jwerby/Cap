export const PORTSTBD_DEFAULT_THEME = "light" as const;

export type Theme = "light" | "dark";

export function resolveTheme(cookieValue: string | undefined): Theme {
	if (cookieValue === "light" || cookieValue === "dark") return cookieValue;
	return PORTSTBD_DEFAULT_THEME;
}

export function script() {
	const cookieValue = (() => {
		if (!document.cookie) return undefined;
		const match = document.cookie.match(/\W?theme=(?<theme>\w+)/);
		return match?.groups?.theme;
	})();

	const pathname = window.location.pathname;
	const isDashboardPath =
		pathname.startsWith("/dashboard") ||
		pathname.startsWith("/login") ||
		pathname.startsWith("/onboarding");

	if (isDashboardPath) document.body.classList.add(resolveTheme(cookieValue));
}
