import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FarmaciaGeojson } from './../interfaces/farmacia.interface';


@Injectable({
  providedIn: 'root'
})
export class FarmaciasService {

  constructor(private http: HttpClient) { }

  getFarmacias() {
    return this.http.get<FarmaciaGeojson[]>('https://farmacias-7d813.firebaseio.com/farmacia2/features.json');
  }
}
