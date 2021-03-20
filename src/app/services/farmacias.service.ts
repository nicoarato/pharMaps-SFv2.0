import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Farmacia } from '../interfaces/farmacia.interface';


@Injectable({
  providedIn: 'root'
})
export class FarmaciasService {

  constructor(private http: HttpClient) { }

  getFarmacias() {
    return this.http.get<Farmacia[]>('https://farmacias-7d813.firebaseio.com/farmacias.json');
  }
}
