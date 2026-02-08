import{c,r as n,j as t}from"./index-DoHRi03N.js";import{C as p}from"./copy-BvbhBv2y.js";/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l=c("Check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]]);function u({value:o,className:s=""}){const[a,e]=n.useState(!1),r=async i=>{i.stopPropagation();try{await navigator.clipboard.writeText(o),e(!0),setTimeout(()=>e(!1),1500)}catch{}};return t.jsx("button",{onClick:r,className:`inline-flex size-6 items-center justify-center rounded-tertiary transition-colors hover:bg-primary ${s}`,title:"Copy to clipboard",children:a?t.jsx(l,{className:"size-3.5 text-green-600"}):t.jsx(p,{className:"size-3.5 text-secondary"})})}export{u as C};
