export function getMidtransConfig() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const production = process.env.MIDTRANS_IS_PRODUCTION === "true";

  if (!serverKey) {
    throw new Error("MIDTRANS_SERVER_KEY belum dikonfigurasi.");
  }

  return {
    serverKey,
    snapUrl: production
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions",
    apiUrl: production
      ? "https://api.midtrans.com/v2"
      : "https://api.sandbox.midtrans.com/v2",
  };
}

export function midtransAuthorization(serverKey: string) {
  return `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
}
