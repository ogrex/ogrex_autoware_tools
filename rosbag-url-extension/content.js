// content.js

// Utility function to detect current page type
function getPageType() {
  const url = window.location.href;

  if (url.includes("tier4.atlassian.net/browse/")) {
    return "jira";
  } else if (url.match(/^https:\/\/console\.mob\.tier4\.jp\/projects\/.+\/rosbag/)) {
    return "mob_rosbag";
  }
  return "other";
}

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
function waitForCopyButton(timeout = 5000) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const buttons = document.querySelectorAll('div[aria-label="Copy"] button');
      if (buttons.length > 0) {
        clearInterval(interval);
        resolve(buttons[buttons.length - 1]); // last button
      }
    }, 100); // check every 100ms

    setTimeout(() => {
      clearInterval(interval);
      reject(new Error("Copy button not found"));
    }, timeout);
  });
}

function getMOBCmd(text) {
  


  // Get the current URL dynamically
  const url = window.location.href;
  // Parse URL
  const urlObj = new URL(url);

  // Extract query params
  const searchParams = urlObj.searchParams;

  // Decode the 'query' parameter
  const queryStr = decodeURIComponent(searchParams.get("query") || "");

  // Helper function to extract ID from the query string
  function extractId(key) {
    const regex = new RegExp(`${key}:\\(([^)]+)\\)`);
    const match = queryStr.match(regex);
    return match ? match[1] : "";
  }
  // Extract IDs dynamically from the current URL
  const projectId = extractField(text, /project_id[:：]\s*([^\n]+)/);
  const vehicleId = extractField(text, /cle_id[:：]\s*([^\n]+)/);
  const environmentId = extractField(text, /ment_id[:：]\s*([^\n]+)/);
  // extract fields 

  const rosbagId = extractField(text, /File ID\s*\n\s*([^\n]+)/);
  const areaMapId = extractField(text, /Area Map\s*\n\s*Shiojiri_Lv4\s*\((.*?)\)/);


  mapVersionId = '';
  navigator.clipboard.writeText = (text) => {
      mapVersionId = text;
      return Promise.resolve(); // pretend the write succeeded
  };

  // 2. Find the copy button by aria-label
  const copyButtons = document.querySelectorAll('div[aria-label="Copy"] button');
  const areaMapButton = copyButtons[copyButtons.length - 1];
  areaMapButton.click()



  // build commands
  const cmdRosbag = `webauto data rosbag pull --project-id ${projectId} --environment-id ${environmentId} --rosbag-id ${rosbagId}`;
  const cmdMap = `webauto map area-map pull --project-id ${projectId} --area-map-id ${areaMapId} --area-map-version-id ${mapVersionId}`;


  const fullCmd = `${cmdRosbag}\n${cmdMap}`;

  return fullCmd;

}

function injectMOBUI(currentUrl, generatedCmd) {
  // Remove old container if exists
  const oldContainer = document.getElementById("mobCmdContainer");
  if (oldContainer) oldContainer.remove();

  const container = document.createElement("div");
  container.id = "mobCmdContainer";
  container.style = `
    position:fixed;
    bottom:10px;
    right:10px;
    background:#fff;
    border:1px solid #ccc;
    padding:10px;
    z-index:9999;
    max-width:400px;
    font-size:12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;

  container.innerHTML = `
    <div style="margin-bottom:8px;">
      <b>Current MOB URL:</b>
      <div style="word-break: break-all; margin:4px 0;">${currentUrl}</div>
      <button id="copyMOBUrl">Copy URL</button>
    </div>
    <div style="margin-bottom:8px;">
      <b>Generated Command:</b>
      <textarea id="mobCmdText" style="width:100%;height:60px;margin:4px 0;">${generatedCmd}</textarea>
      <button id="copyMOBCmd">Copy Download Command</button>
    </div>
    <button id="closeMOBUI" style="margin-top:5px;">Close</button>
  `;

  document.body.appendChild(container);

  // Copy URL
  document.getElementById("copyMOBUrl").addEventListener("click", () => {
    navigator.clipboard.writeText(currentUrl);
  });

  // Copy command
  document.getElementById("copyMOBCmd").addEventListener("click", () => {
    const cmd = document.getElementById("mobCmdText").value;
    navigator.clipboard.writeText(cmd);
  });

  // Close container
  document.getElementById("closeMOBUI").addEventListener("click", () => container.remove());
}



function scanPage() {
  // Main logic
  const text = document.body.innerText;
  const pageType = getPageType();
  if (pageType === "jira") {
    const urls = generateUrls(text);
    if (urls) injectLinks(urls);
  } else if (pageType === "mob_rosbag") {
    const cmd = getMOBCmd(text);
    console.log("Generated MOB Command:\n", cmd);
    if (!cmd) return;
    // Get current URL
    const currentMobUrl = window.location.href;
    injectMOBUI(currentMobUrl, cmd);
  }



}

//scanPage() 
window.addEventListener("load", scanPage);





// webauto map area-map describe --project-id x2_dev --area-map-id 1211

// webauto data rosbag describe --project-id x2_dev --environment-id 8dc58113-7588-4e06-95f8-c9c77858eb67 --rosbag-id fe64ec95-0f53-4770-a82b-8ca3bc8c74b4
// id                  	fe64ec95-0f53-4770-a82b-8ca3bc8c74b4
// datetime            	2025-09-29 05:36:04 - 2025-09-29 05:37:04
// country             	日本
// prefecture          	unregistered
// city                	unregistered
// project_id          	x2_dev
// environment_id      	8dc58113-7588-4e06-95f8-c9c77858eb67
// vehicle_id          	33381cfa-7d30-4e3e-b97c-fbe134ac2bf0









