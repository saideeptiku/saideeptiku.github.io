(function () {
  var data = window.citationMapData;
  var mapElement = document.getElementById("citation-map");

  if (!data || !mapElement) {
    console.error("Map element not found. Ensure #citation-map exists in the DOM.");
    return;
  }

  mapElement.textContent = ""; // Clear any placeholder text
  mapElement.style.height = '420px'; // Keep map height aligned with the Top Countries panel

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(value || 0);
  }

  function setStat(name, value) {
    var element = document.querySelector("[data-citation-stat='" + name + "']");
    if (element) {
      element.textContent = formatNumber(value);
    }
  }

  setStat("uniqueCitingWorks", data.summary.uniqueCitingWorks);
  setStat("mappedInstitutions", data.summary.mappedInstitutions);
  setStat("mappedCountries", data.summary.mappedCountries);
  setStat("hIndex", data.summary.hIndex);
  setStat("i10Index", data.summary.i10Index);
  setStat("selfCitingWorksExcluded", data.summary.selfCitingWorksExcluded);

  var generated = document.querySelector("[data-citation-generated]");
  if (generated) {
    generated.textContent = data.generated;
  }

  var countryList = document.querySelector("[data-citation-countries]");
  if (countryList && data.topCountries) {
    countryList.innerHTML = "";
    data.topCountries.forEach(function (country) {
      var item = document.createElement("li");
      var count = country.affiliationMentions || country.citingWorks || 0;
      item.innerHTML = "<span>" + country.name + "</span><strong>" + formatNumber(count) + "</strong>";
      countryList.appendChild(item);
    });
  }

  if (!window.L || !data.points || !data.points.length) {
    mapElement.classList.add("map-unavailable");
    mapElement.textContent = "Citation map data is unavailable.";
    return;
  }

  var map = L.map(mapElement, {
    attributionControl: true,
    scrollWheelZoom: false,
    worldCopyJump: true,
    zoomControl: true
  }).setView([24, 8], 2);

  function tileUrl(theme) {
    return theme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
  }

  var tileOptions = {
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 18,
    subdomains: "abcd"
  };

  var currentTile = L.tileLayer(
    tileUrl(document.documentElement.getAttribute("data-theme")),
    tileOptions
  ).addTo(map);

  new MutationObserver(function () {
    var theme = document.documentElement.getAttribute("data-theme");
    currentTile.remove();
    currentTile = L.tileLayer(tileUrl(theme), tileOptions).addTo(map);
  }).observe(document.documentElement, { attributeFilter: ["data-theme"] });

  var maxCount = Math.max.apply(
    null,
    data.points.map(function (point) {
      return point.citingWorks;
    })
  );
  var bounds = [];

  data.points.forEach(function (point) {
    var count = point.citingWorks || 1;
    var radius = 5 + 18 * Math.sqrt(count / maxCount);
    var location = [point.lat, point.lon];
    var marker = L.circleMarker(location, {
      color: "#0d3559",
      fillColor: "#a76638",
      fillOpacity: 0.58,
      radius: radius,
      weight: 1.2
    });
    var place = [point.city, point.region, point.country].filter(Boolean).join(", ");
    marker.bindPopup(
      "<strong>" +
        point.name +
        "</strong><br>" +
        place +
        "<br><span>" +
        formatNumber(count) +
        " citing work" +
        (count === 1 ? "" : "s") +
        "</span>"
    );
    marker.addTo(map);
    bounds.push(location);
  });

  if (bounds.length) {
    map.fitBounds(bounds, {
      maxZoom: 2,
      padding: [24, 24]
    });
  }
})();
