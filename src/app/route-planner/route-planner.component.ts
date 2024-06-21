import { Component, OnInit } from '@angular/core';
import * as L from 'leaflet';
import 'leaflet-defaulticon-compatibility';
import Openrouteservice from 'openrouteservice-js';

const ORS_API_KEY = '5b3ce3597851110001cf6248377992aa8d134a0a9423b925b97fcaa1';

@Component({
  selector: 'app-route-planner',
  templateUrl: './route-planner.component.html',
  styleUrls: ['./route-planner.component.scss'],
})
export class RoutePlannerComponent implements OnInit {
  origin: string = '';
  destination: string = '';
  profile: string = 'driving-car';
  route: any = null;
  isochrone: any = null;
  range: number = 600;
  rangeType: string = 'distance';
  distance: number | null = null;
  duration: number | null = null;
  error: string | null = null;
  map: any;
  routeLayer: any;
  isochroneLayer: any;

  ngOnInit() {
    this.map = L.map('map').setView([18.5204, 73.8567], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);
  }

  async geocode(location: string): Promise<[number, number]> {
    const geocode = new Openrouteservice.Geocode({ api_key: ORS_API_KEY });
    const response = await geocode.geocode({ text: location });
    if (response.features && response.features.length > 0) {
      return response.features[0].geometry.coordinates;
    } else {
      throw new Error('No coordinates found for location: ' + location);
    }
  }

  async reverseGeocode(coordinates: [number, number]): Promise<string> {
    const geocode = new Openrouteservice.Geocode({ api_key: ORS_API_KEY });
    const response = await geocode.reverseGeocode({
      point: { lat_lng: coordinates },
    });
    if (response.features && response.features.length > 0) {
      return response.features[0].properties.label;
    } else {
      throw new Error('No place name found for coordinates: ' + coordinates);
    }
  }

  async handleFormSubmit(event: Event) {
    event.preventDefault();
    this.error = null;

    try {
      const originCoords = await this.geocode(this.origin);
      const destinationCoords = await this.geocode(this.destination);

      const directions = new Openrouteservice.Directions({
        api_key: ORS_API_KEY,
      });
      const response = await directions.calculate({
        coordinates: [originCoords, destinationCoords],
        profile: this.profile,
        format: 'geojson',
        radiuses: [1000, 1000],
      });

      if (response.features && response.features.length > 0) {
        const route = response.features[0];
        const routeCoordinates = route.geometry.coordinates.map(
          (coord: [number, number]) => [coord[1], coord[0]]
        );

        this.routeLayer = L.polyline(routeCoordinates, { color: 'blue' }).addTo(
          this.map
        );
        this.map.fitBounds(this.routeLayer.getBounds());

        this.distance = response.features[0].properties.segments[0].distance;
        this.duration = response.features[0].properties.segments[0].duration;
      } else {
        this.error = 'No routes found in the response.';
      }
    } catch (error: any) {
      this.error = 'Error fetching route: ' + error.message;
    }
  }

  async handleIsochroneSubmit(event: Event) {
    event.preventDefault();
    this.error = null;

    try {
      const originCoords = await this.geocode(this.origin);
      const isochrones = new Openrouteservice.Isochrones({
        api_key: ORS_API_KEY,
      });
      const response = await isochrones.calculate({
        locations: [originCoords],
        profile: this.profile,
        range: [this.range],
        units: 'km',
        range_type: this.rangeType,
        attributes: ['area'],
        smoothing: 0.9,
        avoidables: ['highways'],
      });

      if (response.features && response.features.length > 0) {
        this.isochroneLayer = L.geoJSON(response.features, {
          style: { color: 'red' },
        }).addTo(this.map);
        this.map.fitBounds(this.isochroneLayer.getBounds());
      } else {
        this.error = 'No isochrones found in the response.';
      }
    } catch (error: any) {
      this.error = 'Error fetching isochrone: ' + error.message;
    }
  }

  clearRoute() {
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
    this.route = null;
    this.distance = null;
    this.duration = null;
    this.origin = '';
    this.destination = '';
    this.error = null;
  }

  clearIsochrone() {
    if (this.isochroneLayer) {
      this.map.removeLayer(this.isochroneLayer);
      this.isochroneLayer = null;
    }
    this.isochrone = null;
    this.range = 600;
    this.rangeType = 'distance';
    this.origin = '';
    this.error = null;
  }

  getLocation(setter: (value: string) => void) {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const placeName = await this.reverseGeocode([latitude, longitude]);
            setter(placeName);
          } catch (error: any) {
            this.error = 'Error fetching place name: ' + error.message;
          }
        },
        (error) => {
          this.error = "Error fetching user's location: " + error.message;
        }
      );
    } else {
      this.error = 'Geolocation is not supported by this browser.';
    }
  }
}
