import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonContent } from '@ionic/angular';

@Component({
  selector: 'app-export',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent],
  template: '<ion-content></ion-content>',
})
export class ExportPage {}
