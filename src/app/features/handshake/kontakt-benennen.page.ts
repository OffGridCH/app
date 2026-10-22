import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonContent } from '@ionic/angular';

@Component({
  selector: 'app-kontakt-benennen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent],
  template: '<ion-content></ion-content>',
})
export class KontaktBenennenPage {}
