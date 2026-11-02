import { TestBed } from '@angular/core/testing';

import { Atm } from './atm';

describe('Atm', () => {
  let service: Atm;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Atm);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
