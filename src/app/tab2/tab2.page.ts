import { Component, OnInit } from '@angular/core';
import { environment } from '../../environments/environment.prod';


import * as Mapboxgl from 'mapbox-gl';
import { FarmaciasService } from '../services/farmacias.service';
import { Farmacia } from '../interfaces/farmacia.interface';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss']
})
export class Tab2Page implements OnInit {

  mapa: any;
  LngLat: Mapboxgl.LngLat;
  farmacias: Farmacia[] = [];
  visibles = false;
  markers: Mapboxgl.Marker[] = [];
  estilo = 'primary';
  constructor( private farmaciaService: FarmaciasService ) {}

  ngOnInit() {
    // inicializa el mapa
    (Mapboxgl as any).accessToken = environment.mapboxKey;
    this.mapa = new Mapboxgl.Map({
      container: 'mapamapbox', // container id
      style: 'mapbox://styles/mapbox/light-v10',
      center: [-60.707367, -31.6251114], // starting position lng, lat
      zoom: 13 // starting zoom
    });

    this.mapa.addControl(new Mapboxgl.NavigationControl());
    this.mapa.addControl(new Mapboxgl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: true
    }));

    // // Change the cursor to a pointer when the mouse is over the places layer.
    // this.mapa.on('mouseenter', 'places', function() {
    //     this.getCanvas().style.cursor = 'pointer';
    //     });

    // // Change it back to a pointer when it leaves.
    // this.mapa.on('mouseleave', 'places', function() {
    // this.getCanvas().style.cursor = '';
    // });


    setTimeout(() => this.mapa.resize(), 0);

    this.cargarFarmacias();

  }



    // carga el pedido por http
    cargarFarmacias(event?) {
    this.farmaciaService.getFarmacias()
    .subscribe(res => {
      if (event) {
        event.target.complete();
      }
      this.farmacias = res;
      if (this.farmacias.length > 0) {
        console.log('carga exitosa -> filas: ' , this.farmacias.length);
        return true;
        } else {
          console.log('problemas para cargar farmacias');
          return false;
        }
      });
    }

    // muestra todas las farmacias cargadas
    mostrarFarmacias() {
      if (!this.visibles){
        this.visibles = true;
        const farms: Farmacia[] = this.farmacias;
        farms.forEach(farmacia => {
          this.cargarFarmacia(farmacia);
        });
      } else {
        this.visibles = false;
        this.quitarFarmacias();
      }
      this.estilo = ( !this.visibles ? 'primary' : 'danger');
    }

    // carga una farmacia en el mapa
    cargarFarmacia(farmacia: Farmacia) {
      const lng = farmacia.coords[1];
      const lat = farmacia.coords[0];
      const marker = new Mapboxgl.Marker({
        color: '#42d77d',
      })
      .setLngLat([lng, lat])
      .setPopup(new Mapboxgl.Popup({ closeOnClick: false })
                .setLngLat([lng, lat])
                .setHTML(`<p><strong>${farmacia.nombre}</strong>
                          <br>${farmacia.telefono}</p>`))
      .addTo(this.mapa);
      // carga array de marcadores.
      this.markers.push(marker);

    }

    quitarFarmacias() {
      this.markers.forEach(farmacia => {
        farmacia.remove();
      });
      this.markers = [];
      console.log('cantidad de elemntos en markers: ', this.markers.length);
    }



}
