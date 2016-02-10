define ( ['jquery', 'Utils'],function ( $, Utils) {
		
	var Shader ={
            
            shadersURL : null,//shadersURL;
            shaderNum : null,//shadersURL.length;
            shaders : {},
            loaded: false,
            attributes : {
                    displacementx: {
                          type: 'f', // a float
                          value: [] // an empty array
                    },
                    displacementy: {
                          type: 'f', // a float	
                          value: [] // an empty array
                    },
                    displacementz: {
                          type: 'f', // a float
                          value: [] // an empty array
                    },
                    colorattribute : {
                           type: 'v3',
                           value:[]
                    },
                    uniqueid: {
                          type: 'i',
                          value:[]
                   }
               },

             uniformslaser : {
                        indice_time_laser:{type: 'f',value: 1},
                        currentidwork:{type:'f',value:100.},
                        point_size:{type:'f',value:1.},
                        alpha:{type:'f',value:0.5},
                        colortest:{type:'v3', value: {}},
                        nb_time:{type: 'i',value: 0}
             },         

             init: function(shadersURL){
                 this.shadersURL = shadersURL;
                 this.shaderNum =  shadersURL.length;
             },

             loadShaders : function() {              
                 var loadedShaders = 0;
                 var that = this;

                 function partialLoading(shaderContent, shaderName) {
                     loadedShaders++;
                     that.shaders[shaderName] = shaderContent;

                     //all shader files have been loaded
                     if (loadedShaders === that.shaderNum) {
                         that.loaded = true;
                         console.log("Shaders are loaded");
                     }
                 }

                 for (var i=0; i < that.shaderNum; i++) {
                     var currentShaderURL = that.shadersURL[i];

                     (function(currentShaderURL) {
                         $.ajax({
                             url: currentShaderURL,
                             success: function (data) {
                                 partialLoading($(data).html(),currentShaderURL.substr(currentShaderURL.lastIndexOf('/')+1));
                             },
                             dataType: 'html',
                             error: function () {
                                 console.error("Unable to load shader from file" + currentShaderURL);
                             }
                         });
                     })(currentShaderURL);
                 }
             },
            
    shaderTextureProjectiveVS : function(N) { return [
        
        "#ifdef GL_ES",
        "precision  highp float;",
        "#endif",
        "#define N "+N,

        "uniform mat3 mvpp[N];",
        "uniform vec3 translation[N];",
        "varying vec3 v_texcoord[N];",
        "void main() {",
        "    for(int i=0; i<N; ++i) v_texcoord[i] = mvpp[i] * (position-translation[i]);",
        "    gl_Position  =  projectionMatrix *  modelViewMatrix * vec4(position,1.);",
        "}"
    ].join('\n');},
    
     shaderTextureProjectiveFS : function(N) { return [
         
        "#ifdef GL_ES",
        "precision  highp float;",
        "#endif",
        "#define N "+N,
        
        "varying vec3      v_texcoord[N];",
        "uniform sampler2D mask[N];",
        "uniform sampler2D texture[N];",
        "uniform float     alpha[N];",
        "uniform vec2      size[N];",
        "uniform vec2      pps[N];",
        "uniform vec4      distortion[N];",
        "const float amin = 0.5;",

      " vec2 correctDistortionAndCoord(vec4 dist, vec2 pps, vec2 size, vec3 coord){",
      "      vec2 p = coord.xy/coord.z;",
      "      vec2 v = p - pps;",
      "      float v2 = dot(v,v);",
      "      if(v2>dist.w || coord.z < 0.) return vec2(-1.);",
      "      float r = v2*(dist.x+v2*(dist.y+v2*dist.z));",
      "      return p+r*v; ",
      "  }",

      "vec4 getColor(sampler2D texture, sampler2D mask, vec2 size, vec2 p)",
      " {  ",
      "   vec2 d2 = min(p.xy,size-p.xy);",
      "   float d = min(d2.x,d2.y);",
      "   if (d<0.) return vec4(0.);",
      "   p /= size;",
      "   p.y = 1. - p.y; ",
      "   vec4 c = texture2D(texture,p);",
      "   float m = min(d*0.02,1.-texture2D(mask,p).r);",
      "   return c*m;",
      " }",

      "vec4 getColor(sampler2D texture, sampler2D mask, vec4 dist, vec2 pps, vec2 size, vec3 coord)",
      " {  ",
      "   return getColor(texture,mask,size,correctDistortionAndCoord(dist,pps,size,coord));",
      " }",

      " void main(void)",
      " { ",
      "  vec4 color  = vec4(0.);",
      "  vec4 color0 = vec4(0.);",
      "  int blend = 0;",
      "  for(int i=0; i<N; ++i) {",
      "    vec4 c = getColor(texture[i],mask[i],distortion[i],pps[i],size[i],v_texcoord[i]);",
      "    color0 += c;",
      "    color  += alpha[i]*c;",
      "    if(c.a>0.) ++blend;",
      "  }",
      "  if(color0.a>1.) color0 /= color0.a;",
      // if blending 2 images or more with sufficient opacity, return the normalized opaque color
      // else mix the alpha-weighted color with the non-alpha-weighted color
      "  gl_FragColor = (blend>1 && color.a>amin) ? color/color.a : color/amin+(1.-color.a/amin)*color0; ",
   "} "         
     
    ].join('\n');},
        
         
       shaderLaserVS :   [
          
      "    #ifdef GL_ES ",
      "    precision mediump float;",
      "    #endif ",

      "    attribute vec3 displacement; ",
      "    attribute float uniqueid; ",


      "    varying vec3 colorpoint;",
      "    uniform float point_size;",
      "    uniform float indice_time_laser;",
      "    uniform float currentidwork;",
      "    uniform float indice_time_laser_tab[160];",

      "    uniform int movementLocked;",

      "    float getSize(float id){",
      "      return (0.5 -indice_time_laser_tab[int(id)]) * 15.;",
      "    }",

      "    void main()",
      "    {",


      "    vec3 newPosition = position;",
      "    gl_PointSize = point_size;     //2.* clamp(6. - (position.y + 2.), 0., 6.); //getSize(uniqueid);//point_size;",

      "    if(movementLocked!=1)",
      "           newPosition = vec3(position.x+ displacement.x*indice_time_laser_tab[int(uniqueid)],",
      "                              position.y+ displacement.y*indice_time_laser_tab[int(uniqueid)],",
      "                              position.z+ displacement.z*indice_time_laser_tab[int(uniqueid)]);",

      "           gl_Position  =  projectionMatrix *  modelViewMatrix * vec4(newPosition,1.);",

      "          colorpoint = color;",

      "      }"
        
       ],
       

       
        shaderLaserFS :   [
        
    "      #ifdef GL_ES ",
    "        precision mediump float;",
    "      #endif",

     "       varying vec3 colorpoint;",
     "       uniform float alpha;",
     "       uniform sampler2D texturePoint;",

      "      void main() ",
     "       {",

       "         gl_FragColor = vec4(colorpoint,alpha);",
 
      "      }	"

        
       ],
       
         shaderBati3DVS :   [

            "#ifdef GL_ES",
            "precision mediump float;",
           " #endif",

           " uniform int textureJPG;",
           " attribute float materialindice;",
           " varying float matindice;",
           " varying vec2 vUv;",
           " varying vec3 vNormal;",
           " varying vec3 pos;",

         "   void main() {",
               " vNormal = normal;",
               " vUv = vec2( uv.x, uv.y );",
               " if(textureJPG ==1) vUv = vec2(vUv.x, 1.- vUv.y);  ",
               " matindice = materialindice;",
               "     pos = position;",
               "   gl_Position  =  projectionMatrix *  modelViewMatrix * vec4( position, 1.0 );",
               "}",
         ],
         
         shaderBati3DFS :   [
             
           " #ifdef GL_ES ",
           " precision highp float;",
           " #endif",


           " uniform sampler2D u_textures[16];",
          "  uniform int textureJPG;",
          "  uniform float alpha;",
           " uniform vec3 light;",

          "  varying float matindice;",
          "  varying vec2 vUv;",
           " varying vec3 vNormal;",
          "  varying vec3 pos;",

          "  vec4 color = vec4(1.,0.,0.,1.);",

          "  void main(void)",
           " {	",
           "         vec2 uv = vUv;",

           "         if (matindice<0.9)      color = texture2D(u_textures[0],uv);",
           "         else if (matindice<1.9) color = texture2D(u_textures[1],uv);",
           "         else if (matindice<2.9) color = texture2D(u_textures[2],uv);",
           "         else if (matindice<3.9) color = texture2D(u_textures[3],uv);",
           "         else if (matindice<4.9) color = texture2D(u_textures[4],uv);",
           "         else if (matindice<5.9) color = texture2D(u_textures[5],uv);",
           "         else if (matindice<6.9) color = texture2D(u_textures[6],uv);",
           "         else if (matindice<7.9) color = texture2D(u_textures[7],uv);",
           "         else if (matindice<8.9) color = texture2D(u_textures[8],uv);",
           "         else if (matindice<9.9) color = texture2D(u_textures[9],uv);",
           "         else if (matindice<10.9) color = texture2D(u_textures[10],uv);",
           "         else if (matindice<11.9) color = texture2D(u_textures[11],uv);",
           "         else if (matindice<12.9) color = texture2D(u_textures[12],uv);",
           "         else if (matindice<13.9) color = texture2D(u_textures[13],uv);",
           "         else if (matindice<14.9) color = texture2D(u_textures[14],uv);",
           "         else if (matindice<15.9) color = texture2D(u_textures[15],uv);",


           "         if(color.r == 0. && color.g ==0.) color =  vec4(vUv.x,vUv.x,vUv.x,0.5);",
                                                                                                //color =  vec4(matindice/2.,1.,1.,1.);
           "        else",
           "               color.a = alpha;",
           "    gl_FragColor = color; //vec4(1.,1.,0.,1.);//texture2D(u_textures[0],uv);",
          " }",
             
             
         ]
             
             
             
             
             
             
         }
 
         return Shader;   
});
