import { Controller } from '@hotwired/stimulus';
import { setExploreUrlParam, getExploreUrlParam, removeExploreUrlParam } from '../scripts/helpers/explore_site_url_params';
import { visit } from '@hotwired/turbo';
import { useDebounce } from 'stimulus-use';

export default class extends Controller {

    static debounces = ['windowResizeCheck']

    static values = {
        placeDetailsUrl: String,
        fetchInfoWindowDataUrl: String,
        exposeUrl: String
    }

    markerWidth = 15;
    markerHeight = 15;
    markerRadius = 10;

    polygonStyles = {
        'focused': {
            strokeColor: "#0f67cb",
            strokeOpacity: 1.0,
            strokeWeight: 3.0,
            fillColor: "white",
            fillOpacity: 0.01,
            clickable: false
        },
        'hovered': {
            strokeColor: "#000000",
            strokeOpacity: 0.5,
            strokeWeight: 1.0,
            fillColor: "#80cb0f",
            fillOpacity: 0.4,
        },
        'default': {
            strokeColor: "#000000",
            strokeOpacity: 0.2,
            strokeWeight: 1.5,
            fillColor: "white",
            fillOpacity: 0.01,
        },
        'hidden': {
            strokeColor: "#000000",
            strokeOpacity: 0.0,
            strokeWeight: 1.0,
            fillColor: "white",
            fillOpacity: 0.0,
        },
    }

    boundaries = []
    markers = []
    markerData = []
    infoWindows = []

    connect() {
        useDebounce(this);

        const urlParam = getExploreUrlParam('placeSelection');
        this.hasBoundary = (urlParam && urlParam['placeId'] > 0);

        if (!(window.globals.mapsWidgetCopy && this.map)) {
            this.initStyle();
            this.initMap();
        }

        if (!window.globals.mapVisible) return;

        this.initMapControls();

        if (this.hasBoundary) {
            this.loadAndShowCurrentBoundary();
        } else {
            this.loadAndShowStateBoundaries();
        }
    }

    initStyle() {
        // Set dynamic height
        const navbarElement = document.getElementById('search-page-navbars');
        this.element.setAttribute('style', 'overflow: hidden; height: calc(100% - ' + navbarElement.offsetHeight + 'px); min-height: 1px;');
    }

    initMap() {
        let bounds = getExploreUrlParam('mapBounds');

        this.mapSettings = {
            mapId: '7658c925775cee30',
            restriction: {
                latLngBounds: {
                    north: 56.656,
                    south: 44.559,
                    east: 27.795,
                    west: -6.702,
                },
            },
            gestureHandling: 'greedy',
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            disableDefaultUI: true
        }

        if (!(bounds && bounds['north'] && bounds['south'] && bounds['west'] && bounds['east'])) {
            this.mapSettings.center = {lat: 51.12756670958324, lng: 10.322283427930675};
            this.mapSettings.zoom = 6;
        }

        this.map = new google.maps.Map(this.element, this.mapSettings);

        this.map.addListener('dragend', () => {
            this.onBoundsChanged(this.map);
        });
        this.map.addListener('zoom_changed', () => {
            // Zoom Changed is instant, so we wait till idle event
            this.zoomChanged = true;
        });
        this.map.addListener('idle', () => {
            if (this.zoomChanged) this.onBoundsChanged(this.map);
        });

        // Recover previous view if page refreshed
        if (bounds && bounds['north'] && bounds['south'] && bounds['west'] && bounds['east']) {
            this.map.fitBounds(bounds, 0);
        } else {
            bounds = this.map.getBounds();
            visit(setExploreUrlParam("mapBounds", bounds));
        }

        const computedStyles = window.getComputedStyle(this.element);
        const display = computedStyles.getPropertyValue('display');
        window.globals.mapVisible = display !== 'none';

        window.removeEventListener("resize", this.windowResizeCheck);
        this.windowResizeCheck = this.windowResizeCheck.bind(this);
        window.addEventListener("resize", this.windowResizeCheck);
    }

    initMapControls() {
        if (this.hasBoundary) {
            if (!this.map.controls[google.maps.ControlPosition.TOP_RIGHT].length) {
                const removeBoundaryButtonDiv = document.createElement('div');
                const removeBoundaryButton = document.createElement('button');
                removeBoundaryButton.classList.add('btn');
                removeBoundaryButton.classList.add('bg-white');
                removeBoundaryButton.classList.add('border-primary');
                removeBoundaryButton.classList.add('rounded');
                removeBoundaryButton.classList.add('shadow-sm');
                removeBoundaryButton.style.margin = "10px 14px 0px 0px";
                removeBoundaryButton.style.paddingBottom = "5px";
                removeBoundaryButton.textContent = "Begrenzung Aufheben";
                removeBoundaryButton.title = "Klicke hier um die Begrenzungung aufzuheben";
                removeBoundaryButton.type = "button";
                removeBoundaryButton.addEventListener("click", () => {
                    this.removeAllBoundaries();
                    this.goToUrl(setExploreUrlParam('placeSelection', {
                        "placeId": ""
                    }));
                });
                removeBoundaryButtonDiv.appendChild(removeBoundaryButton);
                this.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(removeBoundaryButtonDiv);
            }
        } else {
            while (this.map.controls[google.maps.ControlPosition.TOP_RIGHT].length) {
                this.map.controls[google.maps.ControlPosition.TOP_RIGHT].removeAt(
                    this.map.controls[google.maps.ControlPosition.TOP_RIGHT].getLength() - 1
                );
            }
        }
    }

    loadAndShowCurrentBoundary() {
        // Prevent from reload loop
        if (!window.globals.placeTargetChanged) return;
        this.removeAllBoundaries();
        this.fetchCurrentPlaceBoundary();
    }

    loadAndShowStateBoundaries() {
        if (this.map.getZoom() > 8) {
            if (this.map.data.getStyle())
                this.removeAllBoundaries();
            return;
        }
        if (this.map.data.getStyle()) return;
        this.fetchStateBoundaries();
    }

    fetchStateBoundaries() {
        fetch('/build/mapsdata/boundaries/boundaries.json')
            .then(response => response.json())
            .then(data => {
                this.addStateGeoJsonToMap(data, 'default');
            });
    }

    addStateGeoJsonToMap(geoJson, styleKey) {
        let thisStyle = this.polygonStyles[styleKey];
        this.map.data.addGeoJson(geoJson);
        this.map.data.setStyle(thisStyle);

        this.map.data.addListener('mouseover', (event) => {
            const feature = event.feature;
            feature.setProperty('hovered', true);
            this.map.data.setStyle((feature) => {
                const hovered = feature.getProperty('hovered');
                return hovered ? this.polygonStyles['hovered'] : this.polygonStyles['default'];
            });
        });
        this.map.data.addListener('mouseout', (event) => {
            const feature = event.feature;
            feature.setProperty('hovered', false);
            this.map.data.setStyle((feature) => {
                const hovered = feature.getProperty('hovered');
                return hovered ? this.polygonStyles['hovered'] : this.polygonStyles['default'];
            });
        });
        this.map.data.addListener('click', (event) => {
            const feature = event.feature;

            feature.setProperty('clicked', true);
            this.map.data.setStyle((feature) => {
                const clicked = feature.getProperty('clicked');
                return clicked ? this.polygonStyles['focused'] : this.polygonStyles['default'];
            });

            if (window.globals) window.globals.placeTargetChanged = true;
            this.goToUrl(setExploreUrlParam('placeSelection', {
                "placeId": feature.getProperty('placeId'),
            }));
        });
    }

    fetchCurrentPlaceBoundary() {
        let placeId = getExploreUrlParam('placeSelection')['placeId'];
        fetch(this.placeDetailsUrlValue)
            .then(response => response.json())
            .then(data => {
                this.setBoundary('focused', data.boundaryType, data.boundary);
                let bounds = this.getBoundsFromAllPolygons();
                this.map.fitBounds(bounds, 50);
                window.globals.placeTargetChanged = false;
            });
    }

    setBoundary(styleKey, boundaryType, boundaryCoords) {
        let thisStyle = this.polygonStyles[styleKey];

        if (boundaryType === 'MultiPolygon') {
            for (let i = 0; i < boundaryCoords.length; i++) {
                thisStyle.paths = boundaryCoords[i].map(polygon => polygon.map(point => ({lat: Number(point[1]), lng: Number(point[0])})));
                let boundary = new google.maps.Polygon(thisStyle);
                boundary.setMap(this.map);
                this.boundaries.push(boundary);
            }
        } else if (boundaryType === 'Polygon') {
            thisStyle.paths = boundaryCoords.map(polygon => polygon.map(point => ({lat: Number(point[1]), lng: Number(point[0])})));

            let boundary = new google.maps.Polygon(thisStyle);
            boundary.setMap(this.map);

            this.boundaries.push(boundary);
        } else {
            throw new Error('Invalid boundary type: ' + boundaryType);
        }
    }

    removeAllBoundaries() {
        for (let i = 0; i < this.boundaries.length; i++) {
            this.boundaries[i].setMap(null);
        }
        this.boundaries = [];
        this.map.data.forEach((feature) => {
            this.map.data.remove(feature);
        });
        this.map.data.setStyle(null);
    }

    getBoundsFromAllPolygons() {
        let bounds = new google.maps.LatLngBounds();

        for (let i = 0; i < this.boundaries.length; i++) {
            let vertices = this.boundaries[i].getPath();
            for (let j = 0; j < vertices.getLength(); j++) {
                bounds.extend(vertices.getAt(j));
            }
        }

        return bounds;
    }

    // Debounced function
    onBoundsChanged(map) {
        if (!(map && map.getBounds())) return;
        if (!window.globals.mapVisible) return;
        let boundsEncoded = map.getBounds();
        let bounds = boundsEncoded.toJSON()
        this.zoomChanged = false;
        visit(setExploreUrlParam("mapBounds", bounds));
    }

    updateMarkers(event) {
        const markerData = event.detail.markerData;
        for (let i = 0; i < this.markers.length; i++) {
            this.markers[i].setMap(null);
        }
        this.markers = [];
        this.markerData = [];
        for (let i = 0; i < markerData.length; i++) {
            const centerPoint = new google.maps.Point(this.markerRadius, this.markerRadius);
            const markerIcon = {
                url: this.createMarker(this.markerWidth, this.markerHeight, this.markerRadius),
                fillOpacity: 1,
                rotation: 0,
                scale: 1,
                anchor: centerPoint,
                labelOrigin: centerPoint,
            };
            const markerOptions = {
                map: this.map,
                position: { lat: parseFloat(markerData[i].lat), lng: parseFloat(markerData[i].lng) },
                icon: markerIcon
            };
            const marker = new google.maps.Marker(markerOptions);

            marker.addListener("mouseover", () => {
                this.markerHoverStateChangedMap(i, true);
                this.dispatch('marker-hover-state-changed-map', {
                    detail: {
                        mouseover: true,
                        entryIndex: i
                    }
                });
            });

            marker.addListener("mouseout", () => {
                this.markerHoverStateChangedMap(i, false);
                this.dispatch('marker-hover-state-changed-map', {
                    detail: {
                        mouseover: false,
                        entryIndex: i
                    }
                });
            });

            const uid = markerData[i].uid;

            marker.addListener("click", () => {
                this.goToUrl(this.exposeUrlValue.substr(0, this.exposeUrlValue.length - 1) + uid);
            });

            this.markers.push(marker);
        }
        this.markerData = markerData;
    }

    markerHoverStateChanged(event) {
        const styleId = event.detail.mouseover ? 1 : 0;
        const index = event.detail.entryIndex;

        this.markerHoverStateChangedMap(index, styleId);
    }

    markerHoverStateChangedMap(markerIndex, mouseover) {
        const styleId = mouseover ? 1 : 0;

        const thisMarkerIcon = this.markers[markerIndex].getIcon();
        thisMarkerIcon.url = this.createMarker(this.markerWidth, this.markerHeight, this.markerRadius, styleId);
        this.markers[markerIndex].setIcon(thisMarkerIcon);

        this.updateEntryInfoWindow(markerIndex, mouseover);
    }

    createMarker(width, height, radius, styleId = 0) {
        let canvas, context;
        canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        context = canvas.getContext("2d");
        context.clearRect(0, 0, width, height);
        context.fillStyle = (styleId === 0) ? "#b22323" : "#50a644";
        context.strokeStyle = "rgb(255,255,255)";
        context.beginPath();
        context.moveTo(radius, 0);
        context.lineTo(width - radius, 0);
        context.quadraticCurveTo(width, 0, width, radius);
        context.lineTo(width, height - radius);
        context.quadraticCurveTo(width, height, width - radius, height);
        context.lineTo(radius, height);
        context.quadraticCurveTo(0, height, 0, height - radius);
        context.lineTo(0, radius);
        context.quadraticCurveTo(0, 0, radius, 0);
        context.closePath();
        context.fill();
        context.stroke();
        return canvas.toDataURL();
    }

    updateEntryInfoWindow(markerIndex, show) {
        this.removeAllInfoWindows();

        if (!show) return;

        const infoWindowHtml =
              '<div id="content">'
            + '<p class="m-0">'
            + this.markerData[markerIndex].price
            + '</p>'
            + '</div>';

        const infoWindow = new google.maps.InfoWindow({
            content: infoWindowHtml,
            ariaLabel: "Information zum Inserat",
            disableAutoPan: true
        });

        const map = this.map;
        infoWindow.open({
            anchor: this.markers[markerIndex],
            map,
            shouldFocus: false
        });

        this.infoWindows.push(infoWindow);
    }

    removeAllInfoWindows() {
        for (let i = 0; i < this.infoWindows.length; i++) {
            google.maps.event.clearInstanceListeners(this.infoWindows[i]);
            this.infoWindows[i].close();
            this.infoWindows[i] = null;
        }
        this.infoWindows = [];
    }

    windowResizeCheck() {
        const computedStyles = window.getComputedStyle(this.element);
        const display = computedStyles.getPropertyValue('display');
        if (window.globals.mapVisible && display === 'none') {
            window.globals.mapsWidgetCopy = null;
            window.globals.mapVisible = false;
            window.globals.resetMap = true;
            this.goToUrl(removeExploreUrlParam('mapBounds'));
            return;
        }
        if (!window.globals.mapVisible && display === 'block') {
            window.globals.mapVisible = true;
            this.onBoundsChanged(this.map);
        }
    }

    goToUrl(url) {
        visit(url);
    }
}