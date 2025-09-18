document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyzeBtn");
  const documentUpload = document.getElementById("documentUpload");
  const loader = document.getElementById("loader");
  const resultsDiv = document.getElementById("results");
  const decisionMapUl = document.getElementById("decisionMap");
  const decisionMapViz = document.getElementById("decisionMapViz");
  const riskRadarDiv = document.getElementById("riskRadar");
  const coachSection = document.getElementById("coachSection");
  const coachResultDiv = document.getElementById("coachResults");

  // Backend URL Configuration with Fallback
  const RENDER_URL = "https://lexcompass.onrender.com"; // Your actual Render URL
  const LOCAL_URL = "http://localhost:3000";

  let BACKEND_URL = RENDER_URL; // Start with Render as primary
  let isRenderDown = false;

  // Function to check backend health and switch if needed
  async function checkBackendHealth(url) {
    try {
      const response = await fetch(`${url}/health`, {
        method: "GET",
        timeout: 5000, // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      console.warn(`Backend health check failed for ${url}:`, error);
      return false;
    }
  }

  // Function to get available backend URL
  async function getAvailableBackend() {
    // First try Render
    const renderHealthy = await checkBackendHealth(RENDER_URL);
    if (renderHealthy) {
      isRenderDown = false;
      return RENDER_URL;
    }

    console.warn("⚠️ Render backend is down, switching to local backend");
    // Fallback to local
    const localHealthy = await checkBackendHealth(LOCAL_URL);
    if (localHealthy) {
      isRenderDown = true;
      showMaterialNotification(
        "Using local backend (Render is down)",
        "warning"
      );
      return LOCAL_URL;
    }

    throw new Error("Both backends are unavailable");
  }

  // Initialize backend URL on page load
  (async function initializeBackend() {
    try {
      BACKEND_URL = await getAvailableBackend();
      console.log(`🚀 Using backend: ${BACKEND_URL}`);
      updateBackendStatus();
    } catch (error) {
      console.error("❌ No backend available:", error);
      showMaterialNotification("Backend services are unavailable", "error");
      updateBackendStatus(false);
    }
  })();

  // Update backend status indicator
  function updateBackendStatus(isHealthy = true) {
    const statusIndicator = document.getElementById("status-indicator");
    const statusText = document.getElementById("status-text");

    if (!statusIndicator || !statusText) return;

    if (!isHealthy) {
      statusIndicator.className = "w-2 h-2 rounded-full bg-red-500";
      statusText.textContent = "Backend Offline";
      statusText.className = "text-red-600 font-medium";
      return;
    }

    const isRender = BACKEND_URL.includes("onrender.com");
    if (isRender) {
      statusIndicator.className = "w-2 h-2 rounded-full bg-green-500";
      statusText.textContent = "Render Backend";
      statusText.className = "text-green-600 font-medium";
    } else {
      statusIndicator.className = "w-2 h-2 rounded-full bg-yellow-500";
      statusText.textContent = "Local Backend";
      statusText.className = "text-yellow-600 font-medium";
    }
  }

  // Robust fetch function with backend fallback
  async function robustFetch(endpoint, options = {}) {
    let currentBackend = BACKEND_URL;

    try {
      // Try current backend
      const response = await fetch(`${currentBackend}${endpoint}`, {
        ...options,
        timeout: 10000, // 10 second timeout
      });

      if (response.ok) {
        return response;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      console.warn(`❌ Request failed with ${currentBackend}:`, error);

      // Try alternative backend
      const alternativeBackend =
        currentBackend === RENDER_URL ? LOCAL_URL : RENDER_URL;
      console.log(`🔄 Trying alternative backend: ${alternativeBackend}`);

      try {
        const response = await fetch(`${alternativeBackend}${endpoint}`, {
          ...options,
          timeout: 10000,
        });

        if (response.ok) {
          BACKEND_URL = alternativeBackend; // Switch backends
          const backendType =
            alternativeBackend === LOCAL_URL ? "local" : "Render";
          showMaterialNotification(
            `Switched to ${backendType} backend`,
            "info"
          );
          updateBackendStatus(); // Update status indicator
          return response;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (secondError) {
        console.error(`❌ Both backends failed:`, secondError);
        throw new Error(
          "All backend services are unavailable. Please try again later."
        );
      }
    }
  }

  // File upload handling with visual feedback
  documentUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    const label = document.querySelector('label[for="documentUpload"]');

    if (file) {
      label.innerHTML = `📄 ${file.name}`;
      label.className =
        "material-button bg-tertiary text-white cursor-pointer inline-block";
      analyzeBtn.disabled = false;
      analyzeBtn.classList.remove("opacity-50", "cursor-not-allowed");
    } else {
      label.innerHTML = "📁 Choose Document";
      label.className =
        "material-button bg-primary text-white hover:bg-blue-700 cursor-pointer inline-block";
      analyzeBtn.disabled = true;
      analyzeBtn.classList.add("opacity-50", "cursor-not-allowed");
    }
  });

  analyzeBtn.addEventListener("click", async () => {
    const file = documentUpload.files[0];
    if (!file) {
      showMaterialNotification(
        "Please select a .txt file to analyze.",
        "error"
      );
      return;
    }

    // Reset and show loading
    resultsDiv.classList.add("hidden");
    decisionMapUl.innerHTML = "";
    riskRadarDiv.innerHTML = "";
    coachSection.classList.add("hidden");
    loader.classList.remove("hidden");

    const formData = new FormData();
    formData.append("document", file);

    try {
      const response = await robustFetch("/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Analysis failed. Server might be busy.");
      }

      const data = await response.json();
      displayResults(data);
      showMaterialNotification("✅ Document analyzed successfully!", "success");
    } catch (error) {
      console.error("Error:", error);
      showMaterialNotification(`❌ Analysis failed: ${error.message}`, "error");
    } finally {
      loader.classList.add("hidden");
      resultsDiv.classList.remove("hidden");
    }
  });

  function displayResults({ decisionMap, riskRadar }) {
    // Display Decision Map with Material 3 styling
    decisionMap.forEach((item, index) => {
      const card = document.createElement("div");
      card.className =
        "bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow";
      card.innerHTML = `
        <div class="flex items-start space-x-3">
          <div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
            ${index + 1}
          </div>
          <div class="flex-1">
            <p class="text-gray-800 leading-relaxed">${item}</p>
          </div>
        </div>
      `;
      decisionMapUl.appendChild(card);
    });

    // Create centered decision map visualization
    createMaterialDecisionMapViz(decisionMap);

    // Display Risk Radar with Material 3 design
    riskRadar.forEach((risk, index) => {
      const riskCard = document.createElement("div");
      const riskScore = risk.riskScore || 5;
      const riskLevel = getRiskLevel(riskScore);
      const riskColor = getRiskColor(riskScore);
      const riskClass = getRiskClass(riskLevel);

      riskCard.className = `bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border-l-4 ${riskClass}`;

      riskCard.innerHTML = `
        <div class="flex justify-between items-start mb-4">
          <div class="flex items-center space-x-2">
            <span class="material-icons text-2xl" style="color: ${riskColor};">warning</span>
            <h4 class="text-lg font-semibold text-gray-800">Risk Assessment #${
              index + 1
            }</h4>
          </div>
          <div class="flex items-center space-x-2">
            <span class="px-3 py-1 rounded-full text-xs font-medium text-white" style="background-color: ${riskColor};">
              ${riskLevel.toUpperCase()}
            </span>
            <span class="text-xl font-bold" style="color: ${riskColor};">
              ${riskScore}/10
            </span>
          </div>
        </div>
        
        <div class="bg-gray-50 rounded-xl p-4 mb-4">
          <h5 class="font-medium text-gray-700 mb-2">📜 Clause Content:</h5>
          <blockquote class="italic text-gray-600 border-l-3 border-gray-300 pl-3">
            "${risk.clause}"
          </blockquote>
        </div>
        
        <div class="mb-6">
          <h5 class="font-medium text-gray-700 mb-2">⚠️ Risk Analysis:</h5>
          <p class="text-gray-600 leading-relaxed">${risk.risk}</p>
        </div>
        
        <button 
          class="material-button bg-green-600 text-white hover:bg-green-700 w-full"
          onclick="getMaterialCoachSuggestion('${risk.clause.replace(
            /'/g,
            "\\'"
          )}')"
        >
          <span class="material-icons mr-2">psychology</span>
          Get AI Coaching for Safer Clause
        </button>
      `;
      riskRadarDiv.appendChild(riskCard);
    });
  }

  // Material 3 Decision Map Visualization
  function createMaterialDecisionMapViz(decisionMap) {
    const nodes = new vis.DataSet([
      {
        id: 0,
        label: "📄 Document",
        color: { background: "#1565C0", border: "#0D47A1" },
        size: 40,
        font: { color: "white", size: 16, face: "Roboto" },
      },
      ...decisionMap.map((item, index) => ({
        id: index + 1,
        label: `Section ${index + 1}`,
        title: item,
        color: { background: "#42A5F5", border: "#1976D2" },
        size: 25,
        font: { color: "white", size: 12, face: "Roboto" },
      })),
    ]);

    const edges = new vis.DataSet(
      decisionMap.map((_, index) => ({
        from: 0,
        to: index + 1,
        color: { color: "#90A4AE", highlight: "#546E7A" },
        width: 2,
        smooth: { type: "curvedCW", roundness: 0.2 },
      }))
    );

    const container = decisionMapViz;
    const data = { nodes, edges };
    const options = {
      layout: {
        hierarchical: {
          direction: "UD",
          sortMethod: "directed",
          levelSeparation: 100,
          nodeSpacing: 150,
        },
      },
      physics: {
        enabled: true,
        hierarchicalRepulsion: {
          centralGravity: 0.0,
          springLength: 100,
          springConstant: 0.01,
          nodeDistance: 120,
          damping: 0.09,
        },
      },
      nodes: {
        borderWidth: 2,
        shadow: {
          enabled: true,
          color: "rgba(0,0,0,0.2)",
          size: 10,
          x: 2,
          y: 2,
        },
      },
      edges: {
        shadow: {
          enabled: true,
          color: "rgba(0,0,0,0.1)",
          size: 5,
          x: 1,
          y: 1,
        },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
      },
    };

    new vis.Network(container, data, options);
  }

  // Helper functions for risk assessment
  function getRiskColor(score) {
    if (score >= 8) return "#D32F2F"; // Material Red
    if (score >= 6) return "#F57C00"; // Material Orange
    if (score >= 4) return "#FBC02D"; // Material Yellow
    return "#388E3C"; // Material Green
  }

  function getRiskLevel(score) {
    if (score >= 8) return "critical";
    if (score >= 6) return "high";
    if (score >= 4) return "medium";
    return "low";
  }

  function getRiskClass(level) {
    const classes = {
      critical: "border-red-500",
      high: "border-orange-500",
      medium: "border-yellow-500",
      low: "border-green-500",
    };
    return classes[level] || "border-gray-300";
  }

  // Material notification system
  function showMaterialNotification(message, type = "info") {
    const notification = document.createElement("div");
    const colors = {
      success: "bg-green-600",
      error: "bg-red-600",
      info: "bg-blue-600",
      warning: "bg-orange-600",
    };

    notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-4 rounded-2xl shadow-lg z-50 max-w-sm transform transition-all duration-300 translate-x-full`;
    notification.innerHTML = `
      <div class="flex items-center space-x-2">
        <span class="material-icons">
          ${
            type === "success"
              ? "check_circle"
              : type === "error"
              ? "error"
              : "info"
          }
        </span>
        <span>${message}</span>
      </div>
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.classList.remove("translate-x-full");
    }, 100);

    // Animate out and remove
    setTimeout(() => {
      notification.classList.add("translate-x-full");
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }

  // AI Coaching functionality
  window.getMaterialCoachSuggestion = async function (clause) {
    coachSection.classList.remove("hidden");
    coachSection.scrollIntoView({ behavior: "smooth" });

    coachResultDiv.innerHTML = `
      <div class="bg-blue-50 rounded-2xl p-6 text-center">
        <div class="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h4 class="text-lg font-semibold text-blue-800 mb-2">AI Coach Analyzing...</h4>
        <p class="text-blue-600">Generating safer clause suggestions and legal guidance</p>
      </div>
    `;

    try {
      const response = await robustFetch("/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clause }),
      });

      if (!response.ok) {
        throw new Error("Coaching request failed.");
      }

      const data = await response.json();
      displayMaterialCoachResult(data);
      showMaterialNotification("🎯 Clause coaching completed!", "success");
    } catch (error) {
      console.error("Coach Error:", error);
      coachResultDiv.innerHTML = `
        <div class="bg-red-50 rounded-2xl p-6 text-center">
          <span class="material-icons text-red-600 text-4xl mb-2">error</span>
          <p class="text-red-800">Failed to get coaching suggestion: ${error.message}</p>
        </div>
      `;
    }
  };

  function displayMaterialCoachResult({ suggestion, explanation }) {
    coachResultDiv.innerHTML = `
      <div class="space-y-6">
        <!-- Safer Clause Suggestion -->
        <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6">
          <div class="flex items-center mb-4">
            <span class="material-icons text-green-600 text-2xl mr-2">verified</span>
            <h4 class="text-xl font-semibold text-green-800">✨ AI-Improved Clause</h4>
          </div>
          <div class="bg-white rounded-xl p-4 border border-green-200">
            <blockquote class="text-gray-800 leading-relaxed italic font-medium">
              "${suggestion}"
            </blockquote>
          </div>
        </div>
        
        <!-- Explanation -->
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
          <div class="flex items-center mb-4">
            <span class="material-icons text-blue-600 text-2xl mr-2">psychology</span>
            <h4 class="text-xl font-semibold text-blue-800">📚 Legal Analysis & Changes</h4>
          </div>
          <p class="text-gray-700 leading-relaxed">${explanation}</p>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex flex-wrap gap-3">
          <button 
            onclick="copyToClipboard('${suggestion.replace(/'/g, "\\'")}')"
            class="material-button bg-purple-600 text-white hover:bg-purple-700 flex-1 min-w-fit"
          >
            <span class="material-icons mr-2">content_copy</span>
            Copy Improved Clause
          </button>
          <button 
            onclick="exportMaterialAnalysis()"
            class="material-button bg-indigo-600 text-white hover:bg-indigo-700 flex-1 min-w-fit"
          >
            <span class="material-icons mr-2">download</span>
            Export Full Analysis
          </button>
          <button 
            onclick="shareMaterialAnalysis()"
            class="material-button bg-teal-600 text-white hover:bg-teal-700 flex-1 min-w-fit"
          >
            <span class="material-icons mr-2">share</span>
            Share Results
          </button>
        </div>
      </div>
    `;
  }

  // Utility functions
  window.copyToClipboard = function (text) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showMaterialNotification("📋 Copied to clipboard!", "success");
      })
      .catch(() => {
        showMaterialNotification("❌ Failed to copy to clipboard", "error");
      });
  };

  window.exportMaterialAnalysis = function () {
    const analysisData = {
      timestamp: new Date().toISOString(),
      document: documentUpload.files[0]?.name || "Unknown Document",
      decisionMap: Array.from(decisionMapUl.children).map((card) => {
        const text = card.querySelector("p").textContent;
        return text;
      }),
      risks: Array.from(riskRadarDiv.children).map((card) => {
        const clause = card
          .querySelector("blockquote")
          .textContent.replace(/"/g, "");
        const risk = card.querySelector(".mb-6 p").textContent;
        const score = card.querySelector(".text-xl").textContent;
        return { clause, risk, score };
      }),
      coachSuggestion:
        coachResultDiv.querySelector("blockquote")?.textContent || null,
      coachExplanation:
        coachResultDiv.querySelector(".text-gray-700")?.textContent || null,
    };

    const blob = new Blob([JSON.stringify(analysisData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lexcompass-analysis-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showMaterialNotification("📄 Analysis exported successfully!", "success");
  };

  window.shareMaterialAnalysis = function () {
    if (navigator.share) {
      navigator.share({
        title: "LexCompass Legal Analysis",
        text: "Check out my AI-powered legal document analysis from LexCompass!",
        url: window.location.href,
      });
    } else {
      copyToClipboard(window.location.href);
      showMaterialNotification("🔗 Link copied for sharing!", "info");
    }
  };
});
