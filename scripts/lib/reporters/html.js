import fs from "fs";
import path from "path";

const dashboardPath = "../../../dashboard";

export function writeHtmlReport(outputPath) {

  const htmlTemplate = fs.readFileSync(
    path.join(dashboardPath, "index.html"),
    "utf-8"
  );

  const css = fs.readFileSync(
    path.join(dashboardPath, "style.css"),
    "utf-8"
  );

  const js = fs.readFileSync(
    path.join(dashboardPath, "app.js"),
    "utf-8"
  );

  const auditData = fs.readFileSync(
    path.join(outputPath, "report.json"),
    "utf-8"
  );

  // Inyectar CSS inline
  let finalHtml = htmlTemplate.replace(
    '</head>',
    `<style>${css}</style></head>`
  );

  // Inyectar JS inline
  finalHtml = finalHtml.replace(
    '<script src="app.js"></script>',
    `<script>
     window.__AUDIT_DATA__ = ${auditData};
   </script>
   <script>
     ${js}
   </script>`
  );

  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
  }
  fs.writeFileSync(
    path.join(outputPath, "report.html"),
    finalHtml
  );
}

console.log("report.html generado correctamente.");