import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonContent } from '@ionic/angular';

@Component({
  selector: 'app-gruppe-chat',
  template: '<ion-content></ion-content>',
  imports: [IonContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class GruppeChatPage {}
