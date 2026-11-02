/* The audio rendering thread owns the beat clock. No page timer, file-loop
 * boundary or React render can delay or restart the rhythm. */
class GuitarMetronome extends AudioWorkletProcessor {
  constructor() {
    super(); this.cfg=null; this.remaining=0; this.pulse=0; this.voices=[];
    this.port.onmessage=({data})=>{
      if(data.stop){this.cfg=null;this.voices=[];return;}
      if(data.cfg){
        const next=data.cfg,old=this.cfg;
        const per=s=>({none:1,eighth:2,triplet:3,sixteenth:4})[s];
        if(old){
          this.remaining *= (old.bpm*per(old.subdivision))/(next.bpm*per(next.subdivision));
          if(per(old.subdivision)!==per(next.subdivision))this.pulse=Math.floor(this.pulse/per(old.subdivision))*per(next.subdivision);
        }
        this.cfg=next;this.samples=data.samples;
      }
    };
  }
  process(_inputs,outputs) {
    const out=outputs[0][0];out.fill(0);const c=this.cfg;if(!c)return true;
    const per=({none:1,eighth:2,triplet:3,sixteenth:4})[c.subdivision];
    const size=c.weights.length*per,step=sampleRate*60/c.bpm/per;
    for(let i=0;i<out.length;i++){
      if(this.remaining<=0){
        const pulse=this.pulse%size,beat=Math.floor(pulse/per),sub=pulse%per,weight=sub?1:c.weights[beat];
        if(weight){const role=sub?'sub':weight===2||beat===0?'accent':'beat';
          const gain=(sub?.55:weight===2?(beat===0&&per>1?1:.95):beat===0?.8:.9)*.9;
          this.voices.push({samples:this.samples[role],at:0,gain});}
        this.port.postMessage({bar:Math.floor(this.pulse/size),beat,sub,totalPulses:size,pulseIndex:this.pulse,weight,nextPulseSeconds:step/sampleRate});
        this.pulse++;this.remaining+=step;
      }
      let value=0;
      for(const voice of this.voices){if(voice.at<voice.samples.length)value+=voice.samples[voice.at++]*voice.gain;}
      this.voices=this.voices.filter(v=>v.at<v.samples.length);
      out[i]=value*c.volume;this.remaining--;
    }
    return true;
  }
}
registerProcessor('guitar-metronome',GuitarMetronome);
