import { HttpApi, HttpApiError, OpenApi } from "@effect/platform";
import { EXTENSION_HTTP_PREFIX, ExtensionHttpApi } from "../Extension.ts";
import { LoomHttpApi } from "../Loom.ts";

export class ApiContract extends HttpApi.make("cap-web-api")
	.add(ExtensionHttpApi.prefix(EXTENSION_HTTP_PREFIX))
	.add(LoomHttpApi.prefix("/loom").addError(HttpApiError.ServiceUnavailable))
	.annotateContext(
		OpenApi.annotations({
			title: "Port & Starboard Watch HTTP API",
			description:
				"Internal API used by Port & Starboard Watch web and supporting services",
		}),
	)
	.prefix("/api") {}
