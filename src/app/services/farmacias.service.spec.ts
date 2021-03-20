import { TestBed } from '@angular/core/testing';

import { FarmaciasService } from './farmacias.service';

describe('FarmaciasService', () => {
  let service: FarmaciasService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FarmaciasService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
