/**
 * SMS Gateway Service
 * Supports:
 * 1. Fast2SMS (Indian SMS Gateway - easiest for OTP in India)
 *    Env: FAST2SMS_API_KEY
 * 2. Twilio (Global SMS Gateway)
 *    Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 * 3. Dev / Sandbox Mode (Default when no SMS keys are configured)
 *    Logs OTP to console and returns in response for local testing
 */

export async function sendOtpSms(phone, otp) {
    const cleanDigits = String(phone).replace(/\D/g, "");
    const last10 = cleanDigits.slice(-10);

    // 1. Check for Fast2SMS
    if (process.env.FAST2SMS_API_KEY) {
        try {
            const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
                method: "POST",
                headers: {
                    "authorization": process.env.FAST2SMS_API_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    route: "otp",
                    variables_values: otp,
                    numbers: last10,
                }),
            });
            const data = await response.json();
            if (data.return) {
                console.log(`[Fast2SMS] OTP sent successfully to +91 ${last10}`);
                return { success: true, provider: "fast2sms", devMode: false };
            } else {
                console.warn(`[Fast2SMS Warning] ${data.message || JSON.stringify(data)}`);
            }
        } catch (err) {
            console.error("[Fast2SMS Error]", err.message);
        }
    }

    // 2. Check for Twilio
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
        try {
            const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
            const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
            const recipient = `+91${last10}`;
            const body = new URLSearchParams({
                To: recipient,
                From: twilioPhone,
                Body: `Your QueueLess registration OTP is: ${otp}. Valid for 5 minutes. Do not share this with anyone.`,
            });

            const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
                method: "POST",
                headers: {
                    "Authorization": `Basic ${auth}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: body.toString(),
            });
            const data = await res.json();
            if (data.sid) {
                console.log(`[Twilio] OTP sent successfully to ${recipient} (SID: ${data.sid})`);
                return { success: true, provider: "twilio", devMode: false };
            } else {
                console.warn(`[Twilio Warning] ${data.message || JSON.stringify(data)}`);
            }
        } catch (err) {
            console.error("[Twilio Error]", err.message);
        }
    }

    // 3. Fallback: Dev Mode (Local Testing)
    console.log(`\n==============================================`);
    console.log(`📱 [SMS GATEWAY SIMULATOR] Registration OTP`);
    console.log(`To: +91 ${last10}`);
    console.log(`OTP Code: [ ${otp} ]`);
    console.log(`Valid for: 5 minutes`);
    console.log(`==============================================\n`);

    return { success: true, provider: "dev_simulator", devMode: true };
}
