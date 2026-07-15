import * as React from "react";
import {
	type ComponentProps,
	createElement,
	Fragment,
	type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("React", React);

vi.mock("@cap/ui", () => {
	const Container = ({ children }: { children?: ReactNode }) =>
		createElement(Fragment, null, children);
	const PaginationAnchor = ({
		href,
		children,
	}: Pick<ComponentProps<"a">, "children" | "href"> & {
		isActive?: boolean;
	}) => createElement("a", { href }, children);

	return {
		Pagination: Container,
		PaginationContent: Container,
		PaginationEllipsis: () => createElement("span", null, "..."),
		PaginationItem: Container,
		PaginationLink: PaginationAnchor,
		PaginationNext: PaginationAnchor,
		PaginationPrevious: PaginationAnchor,
	};
});

import { CapPagination } from "@/app/(org)/dashboard/caps/components/CapPagination";

describe("CapPagination", () => {
	it("uses the route supplied by the page that owns the pagination", () => {
		const html = renderToStaticMarkup(
			createElement(CapPagination, {
				currentPage: 2,
				totalPages: 4,
				hrefForPage: (page: number) =>
					`/dashboard/spaces/space-123?page=${page}`,
			}),
		);

		expect(html).toContain("/dashboard/spaces/space-123?page=1");
		expect(html).toContain("/dashboard/spaces/space-123?page=2");
		expect(html).toContain("/dashboard/spaces/space-123?page=3");
		expect(html).not.toContain("/dashboard/caps");
	});
});
