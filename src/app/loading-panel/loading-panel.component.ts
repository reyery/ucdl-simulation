import { Component } from '@angular/core';

@Component({
  selector: 'app-loading-panel',
  templateUrl: './loading-panel.component.html'
})
export class LoadingPanelComponent {

  mouseEvent(e: MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
  }
}
