import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonContent } from '@ionic/angular';

@Component({
  selector: 'app-verbinden',
  template: '<ion-content></ion-content>',
  imports: [IonContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class VerbindenPage {}
