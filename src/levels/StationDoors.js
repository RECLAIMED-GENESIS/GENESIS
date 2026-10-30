// Sealed staff doors have opaque privacy glazing; they do not imply playable rooms.
export function dressStationDoor(L, door) {
  const paint=L._std(0x385457,.58,.15),metal=L._std(0x9ba8aa,.32,.7);
  const frame=L._std(0x233438,.65,.25),glass=L._std(0x789495,.28,.25);
  const box=(w,h,d,m,x,y,z)=>L._box(door,w,h,d,m,x,y,z);
  box(1.8,2.6,.1,paint,0,1.3,0);
  for(const x of [-.96,.96])box(.12,2.72,.18,frame,x,1.36,.02);
  box(2.04,.12,.18,frame,0,2.72,.02);
  box(1.68,.3,.025,metal,0,.22,.066);
  box(.42,.76,.025,frame,-.37,1.73,.066);
  box(.33,.66,.012,glass,-.37,1.73,.085);
  for(let i=0;i<6;i++)box(.32,.008,.008,metal,-.37,1.49+i*.095,.095);
  box(.12,.32,.025,metal,.65,1.08,.075);
  box(.27,.045,.12,metal,.58,1.1,.13);
  box(.28,.09,.1,metal,.58,2.49,.1);
  for(const y of [.35,1.3,2.3])box(.06,.12,.1,metal,-.87,y,.08);
  box(1.82,.025,.24,metal,0,.013,.03);
}
