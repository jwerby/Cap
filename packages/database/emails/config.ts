import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { buildEnv, serverEnv } from "@cap/env";
import { PORTSTBD_BRAND } from "@cap/utils";
import { render } from "@react-email/render";
import type { JSXElementConstructor, ReactElement } from "react";

let _ses: SESv2Client | null | undefined;

const ses = () => {
	if (_ses !== undefined) return _ses;

	const region = serverEnv().CAP_AWS_REGION;
	if (!region) {
		_ses = null;
		return _ses;
	}

	const accessKeyId = serverEnv().CAP_AWS_ACCESS_KEY;
	const secretAccessKey = serverEnv().CAP_AWS_SECRET_KEY;

	_ses = new SESv2Client({
		region,
		credentials:
			accessKeyId && secretAccessKey
				? { accessKeyId, secretAccessKey }
				: undefined,
	});
	return _ses;
};

const emailFromDomain = () =>
	serverEnv().EMAIL_FROM_DOMAIN ??
	serverEnv().RESEND_FROM_DOMAIN ??
	"portstbd.com";

const toArray = (value?: string | string[]) =>
	value === undefined ? undefined : Array.isArray(value) ? value : [value];

export const sendEmail = async ({
	email,
	subject,
	react,
	marketing,
	test,
	// Accepted for API compatibility with the former Resend sender; SES
	// SimpleEmail has no native scheduling so this is intentionally ignored.
	scheduledAt: _scheduledAt,
	cc,
	replyTo,
	fromOverride,
}: {
	email: string;
	subject: string;
	react: ReactElement<unknown, string | JSXElementConstructor<unknown>>;
	marketing?: boolean;
	test?: boolean;
	scheduledAt?: string;
	cc?: string | string[];
	replyTo?: string;
	fromOverride?: string;
}) => {
	const client = ses();
	if (!client) {
		return;
	}

	if (marketing && !buildEnv.NEXT_PUBLIC_IS_CAP) return;

	let from: string;
	if (fromOverride) from = fromOverride;
	else if (marketing) from = "Richie from Cap <richie@send.cap.so>";
	else if (buildEnv.NEXT_PUBLIC_IS_CAP)
		from = "Cap Auth <no-reply@auth.cap.so>";
	else from = `${PORTSTBD_BRAND.companyName} <no-reply@${emailFromDomain()}>`;

	const html = await render(react);
	const text = await render(react, { plainText: true });
	const to = test ? "success@simulator.amazonses.com" : email;

	await client.send(
		new SendEmailCommand({
			FromEmailAddress: from,
			Destination: {
				ToAddresses: [to],
				CcAddresses: test ? undefined : toArray(cc),
			},
			ReplyToAddresses: toArray(replyTo),
			Content: {
				Simple: {
					Subject: { Data: subject, Charset: "UTF-8" },
					Body: {
						Html: { Data: html, Charset: "UTF-8" },
						Text: { Data: text, Charset: "UTF-8" },
					},
				},
			},
		}),
	);
};
