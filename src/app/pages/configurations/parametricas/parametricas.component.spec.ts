import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParametricasComponent } from './parametricas.component';

describe('ParametricasComponent', () => {
  let component: ParametricasComponent;
  let fixture: ComponentFixture<ParametricasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParametricasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParametricasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
