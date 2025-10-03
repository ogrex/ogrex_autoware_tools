function extractField(text, regex) {
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function getFromToTs(timestampStr) {
  // Parse as JST
  const [datePart, timePart] = timestampStr.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);

  // Create a Date in JST
  const dtJST = new Date(Date.UTC(year, month - 1, day, hour - 9, minute, second)); 
  // Subtract/ add 2 minutes for window
  const fromTs = Math.floor((dtJST.getTime() - 2 * 60000) / 1000); 
  const toTs   = Math.floor((dtJST.getTime() + 2 * 60000) / 1000); 

  return { fromTs, toTs };
}

function generateUrls(text) {
  const projectId = extractField(text, /project_id[:：]\s*([^\n]+)/);
  const vehicleId = extractField(text, /cle_id[:：]\s*([^\n]+)/);
  const environmentId = extractField(text, /ment_id[:：]\s*([^\n]+)/);

  if (!projectId || !vehicleId) return null;
  // extract all timestamps
  const timestampMatches = [...text.matchAll(/発生時刻[:：]\s*\[?([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2})/g)];
  if (timestampMatches.length === 0) return null;


  const urls = timestampMatches.map(match => {
    const timestampStr = match[1];
    try {
      const { fromTs, toTs } = getFromToTs(timestampStr);
      const mobUrl = `https://console.mob.tier4.jp/projects/${projectId}/rosbag` +
             `?viz=stream&agg=count&from_ts=${fromTs}&to_ts=${toTs}&live=false` +
             `&query=project_id%3A%28${projectId}%29+vehicle_id%3A%28${vehicleId}%29` +
             `+environment_id%3A%28${environmentId}%29`

      return { projectId, vehicleId, environmentId, timestampStr, mobUrl };
    } catch {
      return null;
    }
  }).filter(Boolean); // remove any nulls

  return urls;
}

function injectLinks(urls) {
  const container = document.createElement("div");
  container.style = "position:fixed;bottom:10px;left:10px;background:#fff;border:1px solid #ccc;padding:10px;z-index:9999;max-width:300px;font-size:12px;";
  container.innerHTML = urls.map((u, idx) => `
    <div style="margin-bottom:5px;">
      <b>Case ${idx+1}:</b> ${u.timestampStr} 
      <a href="${u.mobUrl}" target="_blank"> MOB</a>
    </div>
  `).join("") +
  `<button id="copyUrls">Copy URLs</button>
   <button id="closeUrls" style="margin-top:5px;">Close</button>`;
  document.body.appendChild(container);

  document.getElementById("copyUrls").addEventListener("click", () => {
    const text = urlsList.map((u, idx) => `Case ${idx+1} (${u.timestampStr} / ${u.vehicleId}): ${u.mobUrl}`).join("\n");
    navigator.clipboard.writeText(text).then(() => alert("Copied all URLs!"));
  });
  document.getElementById("closeUrls").addEventListener("click", () => container.remove());
}
function extractCases(text) {
  // Match blocks containing project_id, vehicle_id, environment_id, 発生時刻
  const caseRegex = /project_id[:：]\s*([^\n]+)[\s\S]*?vehicle_id[:：]\s*([^\n]+)[\s\S]*?environment_id[:：]\s*([^\n]+)[\s\S]*?発生時刻[:：]\s*([^\n]+)/g;
  const cases = [];
  let match;
  while ((match = caseRegex.exec(text)) !== null) {
    const [_, projectId, vehicleId, environmentId, timestampStr] = match;
    cases.push({ projectId, vehicleId, environmentId, timestampStr });
  }
  return cases;
}


function scanPage() {
  const text = document.body.innerText;
  const urls = generateUrls(text);
  if (urls) injectLinks(urls);
}

window.addEventListener("load", scanPage);
