// One selection per pending question/request; parent resets after completion/error.
export function createChoiceGate(){
 let selected=false;
 return{select(value,onSelect,disabled=false){if(disabled||selected)return false;selected=true;onSelect(value);return true;},reset(){selected=false;}};
}
