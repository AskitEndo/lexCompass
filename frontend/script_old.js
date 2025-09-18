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

  // Make sure you change this to your actual backend URL!
  const BACKEND_URL = "http://localhost:3000";

  // Enable/disable analyze button based on file selection
  documentUpload.addEventListener("change", () => {
    analyzeBtn.disabled = !documentUpload.files[0];
    if (documentUpload.files[0]) {
      analyzeBtn.classList.remove("opacity-50", "cursor-not-allowed");
    } else {
      analyzeBtn.classList.add("opacity-50", "cursor-not-allowed");
    }
  });

  analyzeBtn.addEventListener("click", async () => {
    const file = documentUpload.files[0];
    if (!file) {
      showNotification("Please select a .txt file to analyze.", "error");
      return;
    }

    // Reset previous results
    resultsDiv.classList.add("hidden");
    decisionMapUl.innerHTML = "";
    riskRadarDiv.innerHTML = "";
    coachSection.classList.add("hidden");
    loader.classList.remove("hidden");

    const formData = new FormData();
    formData.append("document", file);

    try {
      const response = await fetch(`${BACKEND_URL}/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Analysis failed. The server might be busy.");
      }

      const data = await response.json();
      displayResults(data);
      showNotification("Document analyzed successfully!", "success");
    } catch (error) {
      console.error("Error:", error);
      showNotification(`Analysis failed: ${error.message}`, "error");
    } finally {
      loader.classList.add("hidden");
      resultsDiv.classList.remove("hidden");
    }
  });

  function displayResults({ decisionMap, riskRadar }) {
    // Display Decision Map with enhanced styling
    decisionMap.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "flex items-start space-x-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700";
      li.innerHTML = `
        <span class="flex-shrink-0 w-8 h-8 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
          ${index + 1}
        </span>
        <span class="text-gray-200">${item}</span>
      `;
      decisionMapUl.appendChild(li);
    });

    // Create decision map visualization
    createDecisionMapViz(decisionMap);

    // Display Risk Radar with enhanced styling and color coding
    riskRadar.forEach((risk) => {
      const riskCard = document.createElement("div");
      const riskColor = risk.riskColor || getRiskColor(risk.riskScore || 5);
      const riskLevel = risk.riskLevel || getRiskLevel(risk.riskScore || 5);
      
      riskCard.className = "bg-gray-800/50 rounded-xl p-6 border-l-4 border-gray-700";
      riskCard.style.borderLeftColor = riskColor;
      
      riskCard.innerHTML = `
        <div class="flex justify-between items-start mb-4">
          <h4 class="text-xl font-semibold text-amber-300">Risk Identified</h4>
          <div class="flex items-center space-x-2">
            <span class="px-3 py-1 rounded-full text-sm font-medium" style="background-color: ${riskColor}20; color: ${riskColor};">
              ${riskLevel.toUpperCase()}
            </span>
            <span class="text-2xl font-bold" style="color: ${riskColor};">
              ${risk.riskScore || 5}/10
            </span>
          </div>
        </div>
        <blockquote class="italic text-gray-300 mb-4 pl-4 border-l-2 border-gray-600">
          "${risk.clause}"
        </blockquote>
        <p class="text-gray-200 mb-4">${risk.risk}</p>
        <button 
          class="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white px-6 py-2 rounded-full transition-all duration-300 transform hover:scale-105"
          onclick="getCoachSuggestion('${risk.clause.replace(/'/g, "\\'")}')"
        >
          🎯 Get Safer Clause
        </button>
      `;
      riskRadarDiv.appendChild(riskCard);
    });
    riskRadar.forEach((risk, index) => {
      const card = document.createElement("div");
      card.className = "bg-gray-900 p-4 rounded-md border-l-4 border-amber-500";
      card.innerHTML = `
                <p class="font-mono text-sm text-gray-300 mb-2"><strong>Clause:</strong> "${risk.clause}"</p>
                <p class="text-amber-300"><strong class="font-semibold">Risk:</strong> ${risk.risk}</p>
                <button data-clause="${risk.clause}" class="coach-btn mt-3 text-sm bg-violet-600 hover:bg-violet-700 text-white py-1 px-3 rounded-full transition">
                    Get Coaching
                </button>
            `;
      riskRadarDiv.appendChild(card);
    });

    // Add event listeners to the new coach buttons
    document.querySelectorAll(".coach-btn").forEach((button) => {
      button.addEventListener("click", getCoaching);
    });
  }

  async function getCoaching(event) {
    const clause = event.target.dataset.clause;
    loader.classList.remove("hidden"); // Show loader for coaching
    coachSection.classList.add("hidden");

    try {
      const response = await fetch(`${BACKEND_URL}/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clause }),
      });

      if (!response.ok) throw new Error("Coaching failed.");

      const data = await response.json();

      coachResultDiv.innerHTML = `
                <p class="font-semibold text-gray-300 mb-2">Suggested Rewrite:</p>
                <p class="font-mono text-sm bg-gray-700 p-3 rounded mb-4">"${data.suggestion}"</p>
                <p class="font-semibold text-gray-300 mb-2">Explanation:</p>
                <p class="text-gray-400">${data.explanation}</p>
            `;
      coachSection.classList.remove("hidden");
      coachSection.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      alert(`Coaching error: ${error.message}`);
    } finally {
      loader.classList.add("hidden");
    }
  }
});
