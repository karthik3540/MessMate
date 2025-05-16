
  document.addEventListener("DOMContentLoaded", function () {
    let currentStep = 1;
    const steps = document.querySelectorAll(".step");
    const progressBar = document.querySelector(".progress-bar");

    const showStep = (step) => {
      steps.forEach((s, index) => {
        s.classList.toggle("active", index === step - 1);
      });
      document.body.className = `bg-step${step}`;
      if (progressBar) {
        progressBar.style.width = step === 1 ? "33%" : step === 2 ? "66%" : "100%";
      }
      currentStep = step;
    };

    // Step 1 validation
    document.getElementById("next1").addEventListener("click", function (e) {
      e.preventDefault();

      const regNo = document.getElementById("reg_no").value.trim();
      const name = document.getElementById("name").value.trim();
      const block = document.getElementById("block").value.trim();
      const roomNo = document.getElementById("room_no").value.trim();

      if (!regNo || !name || !block || !roomNo) {
        alert("❗ Please fill in all fields.");
        return;
      }
      showStep(2);
    });

    // Step 2 validation
    document.getElementById("next2").addEventListener("click", function (e) {
      e.preventDefault();

      const diningMess = document.getElementById("dining_mess").value.trim();
      const messType = document.getElementById("mess_type").value;

      if (!diningMess || !messType) {
        alert("❗ Please fill in all required fields.");
        return;
      }

      showStep(3);
    });

    // Go back to step 1
    document.getElementById("prev1").addEventListener("click", function (e) {
      e.preventDefault();
      showStep(1);
    });

    // Go back to step 2
    document.getElementById("prev2").addEventListener("click", function (e) {
      e.preventDefault();
      showStep(2);
    });

    // Final form submission
    document.getElementById("studentForm").addEventListener("submit", function (e) {
      e.preventDefault();

      const mealType = document.getElementById("meal_type").value;
      const feasibility = document.getElementById("feasibility").value;

      if (!mealType || !feasibility) {
        alert("❗ Please select both Meal Type and Feasibility.");
        return;
      }

      const data = {
        reg_no: document.getElementById("reg_no").value,
        name: document.getElementById("name").value,
        block: document.getElementById("block").value,
        room_no: document.getElementById("room_no").value,
        dining_mess: document.getElementById("dining_mess").value,
        mess_type: document.getElementById("mess_type").value,
        food_suggestion: document.getElementById("food_suggestion").value,
        meal_type: document.getElementById("meal_type").value,
        feasibility: document.getElementById("feasibility").value
      };

      fetch("http://localhost:3000/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      })
        .then(response => response.ok ? response.json() : Promise.reject("Failed to store details."))
        .then(() => {
          alert("✅ Stored successfully!");
          document.getElementById("studentForm").reset();
          showStep(1);
        })
        .catch(error => {
          console.error("Error:", error);
          alert(error);
        });
    });

    // Google Sign-In handler
    window.handleCredentialResponse = function (response) {
      const data = parseJwt(response.credential);
      console.log("User Info:", data);
      alert("Signed in as: " + data.name);
    };

    function parseJwt(token) {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(atob(base64).split("").map(c => {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(""));
      return JSON.parse(jsonPayload);
    }

    // Initial setup
    document.querySelector(".thank-you")?.style.setProperty("display", "none");
    showStep(currentStep);
  });

