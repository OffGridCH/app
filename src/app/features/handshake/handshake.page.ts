import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonContent } from '@ionic/angular';

@Component({
  selector: 'app-handshake',
  template: '<ion-content></ion-content>',
  imports: [IonContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class HandshakePage {}
