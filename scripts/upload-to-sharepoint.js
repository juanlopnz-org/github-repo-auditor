import axios from "axios";
import fs from "fs";

const tenantId = process.env.AZURE_TENANT_ID;
const clientId = process.env.AZURE_CLIENT_ID;
const clientSecret = process.env.AZURE_CLIENT_SECRET;
const siteName = process.env.SHAREPOINT_SITE_NAME;

async function getAccessToken() {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);
  params.append("scope", "https://graph.microsoft.com/.default");
  params.append("grant_type", "client_credentials");

  const response = await axios.post(url, params);
  return response.data.access_token;
}

async function getSiteId(token) {
  const res = await axios.get(
    `https://graph.microsoft.com/v1.0/sites?search=${siteName}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return res.data.value[0].id;
}

async function uploadFile(token, siteId) {
  const fileContent = fs.readFileSync("output/report.html");

  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/report.html:/content`;

  await axios.put(url, fileContent, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/html"
    }
  });
}

(async () => {
  try {
    const token = await getAccessToken();
    const siteId = await getSiteId(token);
    await uploadFile(token, siteId);
    console.log("Archivo subido correctamente a SharePoint.");
  } catch (error) {
    console.error("Error subiendo archivo:", error.response?.data || error.message);
    process.exit(1);
  }
})();