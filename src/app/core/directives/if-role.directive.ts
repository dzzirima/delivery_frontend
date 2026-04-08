import { Directive, Input, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { AuthService } from '../auth.service';

/**
 * Structural directive for role-based rendering.
 *
 * Renders the host element only when the current user's role is included
 * in the provided list. Destroys the view (not just hides it) when the
 * role does not match, keeping the DOM clean.
 *
 * Usage:
 *   <button *ifRole="['ORG_ADMIN', 'SYSTEM_ADMIN']">Admin only</button>
 *   <li *ifRole="['HR', 'MANAGER']">Manager menu item</li>
 *
 * Passing an empty array renders for every authenticated user.
 */
@Directive({
  selector: '[ifRole]',
  standalone: true,
})
export class IfRoleDirective {
  private readonly vcr  = inject(ViewContainerRef);
  private readonly tpl  = inject(TemplateRef<unknown>);
  private readonly auth = inject(AuthService);

  @Input() set ifRole(allowedRoles: string[]) {
    this.vcr.clear();
    const role    = this.auth.role();
    const allowed = !allowedRoles?.length || (role != null && allowedRoles.includes(role));
    if (allowed) {
      this.vcr.createEmbeddedView(this.tpl);
    }
  }
}
