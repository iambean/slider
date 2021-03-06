/**
 * @title : TGP轮播组件（静态）
 * @desc :  1)选定的风格样式下单屏出现N个卡片的形式（例如three-cards）那么创建N+2个li element.多出的两个放在首尾，做连接作用。
 *          2)
 * @author : beanmao@tencent.com
 * @date : 2016/3/16
 */
;
!function(window, undefined){
    'use strict';

    // TODO:INCLUDE_FILE是一个gulp plugin方法，目的是静态引入目标css文件作为字符串使用。
    const cssString = INCLUDE_FILE("./inner-styles.css");
    insertStyleSheets(cssString);

    /**
     * 构造器
     * @param wrapper {HTMLElement} 指定的容器
     * @param options {Object}
     * @constructor
     */
    function Slider(wrapper, options){
        //参数
        let _defaults = {

            //主区域UI风格相关
            contentStyle : {
                effect : 'translation', //默认为左右平移的效果
                background : 'cover', //默认背景图是填充。
                //cardWidth : 718, //某些情形下拉伸时需要固定卡片的宽度。
                showPrevAndNext : true //是否展示前后导航的按钮（如果条件满足）
            },

            //导航栏（如缩略图）UI风格相关
            navStyle : {
                //tab切换的风格，默认thumb缩略图模式。可选'none'/'thumb'/'title'/'disc'
                type : 'disc',
                //导航栏是否需要左右箭头
                showPrevAndNext : false
            },

            //鼠标hover到item上是否暂停自动播放
            pauseWhenHoverItem : true,

            //鼠标hover到导航选项时，是否slide到对应item
            slideWhenHoverItem : false,

            //轮播执行的相关参数
            autoRun : true,        //是否自动播放
            startAt : 0,            //初始化展示第几个item，默认第一个
            duration : 500,         //轮播过程持续时间
            delay : 3000,           //轮播结束后到下次开始的延迟时间
            easing : 'ease-out',    //翻页切换的timing-function，默认'ease-in',建议不赋值。同css transition-timing-function.，支持自定义cubic-bezier.

            //自定义的className. 附加在wrapper上。
            ownClass : '',

            // [视频专有]是否默认静音
            videoDefaultMuted : false,

            //发生滑动之前的回调
            beforeSlide : function(item, index){},

            //滑动过程中(动画执行过程)TODO:暂未实现
            onSliding : function(item, index){},

            //一个item划过来后，响应的回调
            afterSlide : function(item, index){},

            //每个item的公共点击行为，如数据上报等。
            onItemClick : function(e, item, index, li){},

            //导航栏元素（取决于navStyle的type形态）的click事件
            onNavItemClick : function(e, item, index){},

            //导航左右箭头允许自定义. direct: -1(左箭头)， 1(右箭头)
            onNavButtonClick : function(e, direct){},

            //轮播项 {Array}.
            items : []
        };

        //基本参数检查
        if(!(wrapper instanceof HTMLElement) || !options.items){
            throw new Error("基本参数校验失败，请检查参数。", options);
        }

        //补齐默认参数
        for(let i in _defaults){
            if(!(i in options)){
                options[i] = _defaults[i];
            }
        }

        // contentStyle的默认值
        let contSty = options.contentStyle;
        // 默认展示主区域的左右箭头按钮
        !("showPrevAndNext" in contSty) && (contSty.showPrevAndNext = true);
        // 默认是平移的类型
        !("effect" in contSty) && (contSty.effect = "translation");
        //对历史版本的支持：
        if(contSty.effect === "three-cards" || contSty.effect === "five-cards"){
            contSty.effect = "slider-3d";
        }
        // 背景图片默认是cover类型的
        !("background" in contSty) && (contSty.background= "cover");

        // navStyle的默认值
        let navSty = options.navStyle;
        // 默认不展示导航区域的左右箭头按钮
        !("showPrevAndNext" in navSty) && (navSty.showPrevAndNext = false);
        // 默认导航栏是小圆点
        !("type" in navSty) && (navSty.type = "disc");

        //如果导航栏是gallery模式，强制将导航栏的左右箭头显示出来
        if( navSty.type === "gallery" ){
            navSty.showPrevAndNext = true;
        }

        this.options = options;

        this.wrapper = wrapper;

        //当前实例的唯一ID
        this.id = `TGP_slider_${Slider.instances.length}`;

        //定义slider的当前状态（仅内部可写）
        this._status = "stopped";

        //当前的索引序号（仅内部可写）
        this.__current_index = options.startAt;

        //全局计时器（仅内部可写）, serTimeout的每一次重置都会变更。私有属性，不适宜抛出去
        this.__auto_play_timer = 0;

        const cardWidth = options.contentStyle.cardWidth;
        // const wrapperWidth = wrapper.offsetWidth;

        //需要设置宽度
        let css = `#${this.id}.tgp-slider li{transition:${this.transition_string};}`;
        (cardWidth > 0 )&& (css += `
            #${this.id}.tgp-slider li{width: ${cardWidth}px;margin-left:-${cardWidth/2}px;left:50%;}
            #${this.id}.tgp-slider .tgp-figure{width: ${cardWidth}px;}
        `);
        //#${this.id}.tgp-slider .focusthumb{width: ${cardWidth}px;max-width:${wrapperWidth}px;margin-left:-${cardWidth/2}px;left:50%;}
        insertStyleSheets(css);

        // 根据参数生成基本的html骨架结构
        _make_skeleton(this);

        // html结构初始化后计算几个关键dom节点， wrapper可以是id或者dom
        let _wp = wrapper;

        this.elements = {
            viewport    : $('[tag="viewport"]', _wp),
            prevBtn     : $('[tag="prev"]', _wp),
            nextBtn     : $('[tag="next"]', _wp),
            navigator   : $('[tag="nav_area"]', _wp),
            navPrevBtn  : $('[tag="nav_prev"]', _wp),
            navNextBtn  : $('[tag="nav_next"]', _wp),
            navItems    : $('[tag="nav_viewport"]', _wp),
        };

        //初始化事件、设置初始值。
        _init(this);

        //一切ready,如果需要自动播放就开始轮播
        if(options.autoRun){
            this.run();
        }

        Slider.instances.push(this);
    }

    Slider.prototype = {
        /**
         * 还原构造器
         */
        constructor : Slider,

        /**
         * 当前slider实例的唯一标记
         */
        id : '--',

        /**
         * 相关element元素抛出来
         */
        wrapper : null,

        elements : {
            viewport : null, // 主区域items
            prevBtn : null, //主区域左右箭头按钮
            nextBtn : null,
            navigator : null,//导航区
            navPrevBtn  : null, //导航左右箭头
            navNextBtn  : null,
            navItems    : null //导航区items的容器
        },

        /**
         * 是否是单帧多图模式
         */
        get mutliple (){
            return this.options.items.some(function(item){
                return item instanceof Array;
            });
        },

        /**
         * slider的当前状态。外部可访问，仅内部可写
         */
        _status : "stopped",
        get status(){
            return this._status;
        },

        /**
         * slider的transition属性值。只读
         */
        get transition_string(){
            //TODO:这里认为透明变化和位移变化是互斥的，不会同时存在。
            const effect = this.options.contentStyle.effect,
                prop = effect === "fade" ? "opacity" : "transform";
            return `${prop} ${this.options.duration}ms ${this.options.easing}`;
        },

        ///**
        // * 全局计时器,serTimeout的每一次重置都会变更。仅内部可读写
        // */
        //__auto_play_timer : 0,

        /**
         * 轮播数据源的总长度。
         */
        get itemsSize (){
            return this.options.items.length;
        },

        /**
         * 当前主位置显示的item的索引号（在items里面的排序序号， [0, N-1]）
         */
        __current_index : 0,
        get currentIndex (){
            return this.__current_index;
        },

        /**
         * 当前主位置显示的item。
         */
        get currentItem (){
            return this.options.items[this.__current_index];
        },

        /**
         * 当前主位置显示的html元素（<li>）
         */
        get currentLiElement (){
            // let vp = this.elements.viewport,
            //     index = this.currentIndex,
            //     a = $(`a[data-index="${index}"]`, vp);
            // return a && a.parentElement; // return <li>.
            return $(`li.current`, this.elements.viewport);
        },

        /**
         * 设置其中一个li的数据
         * 支持两种调用方式：setItemData(liA, 2);setItemData([liA, 2], [liB, 3], [liC, 5],...);
         * @param liEle
         * @param itemIndex
         * @returns {Slider}
         */
        setItemData : function (liEle, itemIndex){
            let slider = this;
            //多项合并模式调用
            if(Array.isArray(arguments[0])){
                [].forEach.call(arguments, function(argItem){
                    Array.isArray(argItem) && slider.setItemData.call(slider, ...argItem);
                });
                return this;
            }
            //防止越界
            itemIndex = (itemIndex + this.itemsSize) % this.itemsSize;
            let item = slider.options.items[itemIndex];

            if(slider.mutliple){
                liEle.innerHTML = item.map(function(itemX, i){
                    return `
                        <a href="#" class="tgp-figure" data-indexes="${itemIndex}-${i}" style="background-image: url(${itemX.image});">
                            <span class="tgp-figure-title">${itemX.title}</span>
                        </a>
                    `;
                }).join("");
            }else{
                //格式是图片/视频/自定义html
                liEle.innerHTML = '<a class="tgp-figure" href="#"></a>';
                let aLink = liEle.firstElementChild;
                switch(true){
                    //video的优先级比image更高。
                    case 'video' in item:
                        setVideo(aLink, item);
                        break;
                    case 'image' in item:
                        setImage(aLink, item);
                        break;
                    // TODO:暂不支持自定义HTML
                    //case 'html' in item:
                    //    liEle.innerHTML = item.html;
                    //    break;
                    default : break;
                }
                aLink.dataset["indexes"] = itemIndex;
            }

            return this;

            function setVideo(aLink, item){
                aLink.style.backgroundImage = 'none';
                aLink.className = "tgp-figure video";
                aLink.innerHTML = `
                        <video width="100%" height="100%" controls>
                            <source src="${item.video}" type="video/mp4">
                        </video>`;
                let videoEle = aLink.firstElementChild;
                item.poster && (videoEle.setAttribute('poster', item.poster));
                slider.options.videoDefaultMuted && videoEle.setAttribute('defaultMuted', true);
                videoEle.onplay = function(){
                    aLink.classList.remove('video');
                };
                videoEle.onpause = function(){
                    aLink.classList.add('video');
                };
            }

            function setImage(aLink, item){
                aLink.style.backgroundImage = `url(${item.image})`;
                aLink.className = "tgp-figure";
                aLink.innerHTML = '';
            }
        },

        /**
         * 设置隐藏的两个边界li的数据，由于已经有currentIndex和li.className来记录当前态，
         * 因此两个侧边的li元素和对应数据都是确定的，不需要传参.
         * @returns {Slider}
         */
        resetHiddenData : function (){
            let vp = this.elements.viewport,
                leftHiddenLi = $('.left-hider', vp),
                rightHiddenLi = $('.right-hider', vp);
            return this.setItemData(
                [leftHiddenLi, this.currentIndex - 2],
                [rightHiddenLi, this.currentIndex + 2]
            );
        },

        /**
         * 开始（继续）执行轮播动作
         * @param {Number} index 从第几帧开始播放，默认从之前停止的索引位置继续
         * @returns {Slider}
         */
        run : function(){
            //console.log("running");
            let slider = this;
            this._status = 'playing';
            //如果是自动播放的视频，则等播放结束自动跳到下一帧；否则（图片或者非自动播放的视频）按照delay的时长跳到下一帧。
            let item = slider.currentItem;
            if(item.video && item.autoPlay){
                let videoEle = $("video", slider.currentLiElement);
                // console.log(videoEle);
                videoEle.onended = function(){
                    slider.slideToNext().run();
                }
            }else{
                this.__auto_play_timer = window.setTimeout(function(){
                    slider.slideToNext().run();
                }, this.options.delay);
            }
            return this;
        },

        /**
         * 停止（暂停）轮播动作
         * @param reset {Boolean} 是否重置到初始位置
         * @returns {Slider}
         */
        stop : function(reset){
            window.clearTimeout(this.__auto_play_timer);
            this._status = 'stopped';
            if(reset){
                //TODO: 重置操作
            }
            return this;
        },

        /**
         * 跳转到指定的索引序号(sourceItem#size范围内)
         * @param {Number} index 目标位置，注意，index的值有可能越界，超出itemsSize。动画执行的方向取决于index - currIndex是否>0。
         * @returns {Slider}
         */
        slideTo : function(index){
            //console.log("slideTo:", index, this.currentIndex);
            (typeof index !== "number") && (index = 0);
            let slider = this;

            if(index === this.currentIndex){
                return this;
            }else{
                let _before = slider.options.beforeSlide,
                    _index = slider.currentIndex,
                    _ele = slider.currentLiElement,
                    item = slider.options.items[_index];
                if(typeof _before === "function"){
                    _before.call(slider, item, _index, _ele);
                }
                _move(index - this.currentIndex);
            }

            // 开始执行动画，delta的正负决定方向，大小决定次数。
            // 大于一定向右运动，小于一定向左，由于调用处的约束关系，delta已经不为0
            function _move(delta){
                //如果目标页码比当前值大，那么前进index - this.currentIndex页，否则后退
                let leftHider = getLi('left-hider'),
                    lefter = getLi('lefter'),
                    current = getLi('current'),
                    righter = getLi('righter'),
                    rightHider = getLi('right-hider');

                //console.log("times", times);
                if(delta > 0){//正向（从左往右滑动）
                    //更新私有变量，slider.currentIndex为只读属性
                    slider.__current_index = (slider.currentIndex + 1 + slider.itemsSize) % slider.itemsSize;

                    deliver(leftHider, 'right-hider');
                    resetClassName([
                        [lefter, 'left-hider'],
                        [current, 'lefter'],
                        [righter, 'current'],
                        [rightHider, 'righter']
                    ]);

                    //如果中间有多步过渡，嵌套调用函数体；否则就表示当前就到了目标位置，那么判断是否需要执行afterSlide的回调
                    if(delta - 1 > 0){
                        window.setTimeout(_move.bind(null, delta - 1), 100);
                    }else{
                        let _after = slider.options.afterSlide,
                            _index = slider.currentIndex,
                            _ele = slider.currentLiElement;
                        if(_after){
                            bindEvent(righter, 'transitionend', function _end(){
                                let item = slider.options.items[_index];
                                _after.call(slider, item, _index, _ele);
                                righter.removeEventListener('transitionend', _end);
                            });
                        }
                    }

                }else if(delta < 0){//反向（从右往左滑动）
                    //更新私有变量，slider.currentIndex为只读属性
                    slider.__current_index = (slider.currentIndex - 1 + slider.itemsSize) % slider.itemsSize;

                    resetClassName([
                        [leftHider, 'lefter'],
                        [lefter, 'current'],
                        [current, 'righter'],
                        [righter, 'right-hider']
                    ]);
                    deliver(rightHider, 'left-hider');

                    //如果中间有多步过渡，嵌套调用函数体；否则就表示当前就到了目标位置，那么判断是否需要执行afterSlide的回调
                    if(delta + 1 < 0){
                        window.setTimeout(_move.bind(null, delta + 1), 100);
                    }else{
                        let _after = slider.options.afterSlide,
                            _index = slider.currentIndex,
                            _ele = slider.currentLiElement;
                        if(_after){
                            bindEvent(lefter, 'transitionend', function _end(){
                            	let item = slider.options.items[_index];
                                _after.call(slider, item, _index, _ele);
                                lefter.removeEventListener('transitionend', _end);
                            });
                        }
                    }

                }

                // 更新两侧两个隐藏<li>的数据
                slider.resetHiddenData();

                // 更新导航栏的当前态UI
                // TODO:Array.from 在qbblink上还不支持. chrome45以上才支持。
                // see:https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Array/from
                // let linkElements = Array.from($all("a", slider.elements.navItems));
                let linkElements = [].slice.call($all("a", slider.elements.navItems), 0);
                linkElements.forEach(function(linker){
                    linker.className = "";
                    if(linker.dataset['index']+"" === slider.currentIndex+""){
                        linker.className = "cur";
                    }
                });
            }

            //按照classname获取li
            function getLi(className){
                let vp = slider.elements.viewport;
                return $(`li.${className}`, vp);
            }

            //将某个li无动画过渡直接变换到另一个状态
            function deliver(ele, targetClassName){
                let eleStyle = ele.style;
                eleStyle['transition'] = 'none';
                eleStyle['visibility'] = 'hidden';
                ele.className = targetClassName;

                setTimeout(function(){
                    eleStyle['transition'] = slider.transition_string;
                    eleStyle['visibility'] = 'visible';
                }, 0);
            }

            //清除掉指定element的className，再赋值。
            function resetClassName(list){
                list.forEach(function(setting){
                    setting[0].className = setting[1];
                });
            }
            return this;
        },

        /**
         * 后退一个单位
         * @returns {Slider}
         */
        slideToPrev : function(){
            return this.slideTo(this.currentIndex - 1);
        },

        /**
         * 前进一个单位
         * @returns {Slider}
         */
        slideToNext : function(){
            return this.slideTo(this.currentIndex + 1);
        }
    };

    //实例集合
    Slider.instances = [];

    //------------------------------------------------------------------------------------------------

    /**
     * 根据参数生成基本的html骨架结构
     * @private
     */
    function _make_skeleton(slider){
        let options = slider.options,
            contSty = options.contentStyle,
            navSty = options.navStyle;

        let sliderClass = ['tgp-slider', contSty.effect, contSty.background];
        slider.mutliple && (sliderClass.push("mutliple"));
        options.ownClass && (sliderClass.push(options.ownClass));

        sliderClass = sliderClass.join(" ");
        // console.log(slider.id, sliderClass);
        let navClassName = {
                "thumb"     : "focusthumb",             //缩略图，默认
                "disc"      : "focusthumb thumb-dot",   //小圆点
                "title"     : "focusthumb thumb-txt",   //标题文字
                "gallery"   : "focusthumb gallery"      //整组切换。此模式下，navStyle.showPrevAndNext强制设为true。
            }[navSty.type];

        slider.wrapper.innerHTML = `
            <div id="${slider.id}" class="${sliderClass}">
                <div tag="prev" class="slide-btn-pre" style="display: none;" href="#"></div>
                <div tag="next" class="slide-btn-next" style="display: none;" href="#"></div>
                <ul tag="viewport" class="slider-viewport">
                    <li class="left-hider"><a class="tgp-figure" href="#"></a></li>
                    <li class="lefter"><a class="tgp-figure" href="#"></a></li>
                    <li class="current"><a class="tgp-figure" href="#"></a></li>
                    <li class="righter"><a class="tgp-figure" href="#"></a></li>
                    <li class="right-hider"><a class="tgp-figure" href="#"></a></li>
                </ul>
                <div tag="nav_area" class="focusthumb-wp" style="display: none;">
                    <div tag="nav_prev" class="slide-btn-pre" style="display: none;" href="#"></div>
                    <div tag="nav_next" class="slide-btn-next" style="display: none;" href="#"></div>
                    <div tag="nav_viewport" class="${navClassName}" >
                        ${generateThumbs(options)}
                    </div>
                </div>
            </div>`;

        //生成缩略图（如果需要）
        function generateThumbs(options){
            return options.items.map(function(item, index){
                //缩略图
                let thumbHtml = '',
                    thumb = item.thumb || item.image || item.poster;
                if(thumb){
                    thumbHtml = `<img src="${thumb}" />`
                }
                return `
                    <a href="#" hidefocus data-index="${index}">
                        ${thumbHtml}    
                        <span>${item.title||""}</span>
                    </a>`;
            }).join('');
        }
    }

    /**
     * //初始化（绑定向前向后的点击事件、点击导航栏缩略图跳转、定时轮播等）
     * @private
     */
    function _init(slider){
        let options = slider.options,
            elements = slider.elements;

        //设置初始数据(包含两个隐藏li)
        let currLi = $('.current', elements.viewport),
            ul = currLi.parentElement,
            currIndex = slider.currentIndex;

        slider.setItemData(
            [currLi,                currIndex],
            [$("li.lefter", ul),    currIndex - 1],
            [$("li.righter", ul),   currIndex + 1],
            [$("li.left-hider", ul),currIndex - 2],
            [$("li.right-hider",ul),currIndex + 2]
        );

        //设置导航当的当前态
        let navItems = slider.elements.navItems;
        $(`a[data-index="${currIndex}"]`, navItems).classList.add('cur');

        //需要展示前进后退箭头按钮，则展示出来，并绑定事件
        if(options.contentStyle.showPrevAndNext) {
            let prev = elements.prevBtn,
                next = elements.nextBtn,
                delayThreshold = 300;
            prev.style.display = '';
            bindEvent(prev, 'click', function () {
                slider.stop();
                if (!this.timer) {
                    this.timer = 0;
                }
                if (Date.now() - this.timer > delayThreshold) {
                    slider.slideToPrev();
                    this.timer = Date.now();
                }
                return false;
            });

            next.style.display = '';
            bindEvent(next, 'click', function () {
                slider.stop();
                if (!this.timer) {
                    this.timer = 0;
                }
                if (Date.now() - this.timer > delayThreshold) {
                    slider.slideToNext();
                    this.timer = Date.now();
                }
                return false;
            });
        }

        //hover到item上时暂停轮播
        if(options.pauseWhenHoverItem){
            //需要一个单独的是否是由于hover导致的暂停的标记位。
            let _in_viewport = false;
            bindEvent(elements.viewport, 'mouseenter', function(){
                //如果当前正在播放中，那么停止播放，并将状态值改为暂停；如果是非播放状态，则不管。
                if(slider.status === "playing"){
                    slider.stop();
                    _in_viewport = true;
                }
                return false;
            });
            bindEvent(elements.viewport, 'mouseleave', function(){
                //如果当前正在暂停中，那么立即恢复播放。
                if(_in_viewport && slider.status === "stopped"){
                    slider.run();
                    _in_viewport = false;
                }
                return false;
            });
        }

        //每个item的点击行为处理
        let itemElements = $all('li', slider.elements.viewport);
        bindEvent(itemElements, 'click', 'a', function(e){
            let a = this,
                //判断是否需要阻止冒泡、阻止默认行为
                returnValue = false,
                li = a.closest('li');

            // 有可能是单帧多图模式（items为二维数组）
            let indexes = a.dataset['indexes'].split('-'),
                totalIndex = indexes[0] * 1,//item第一层
                item = indexes.length === 1 ?
                    slider.options.items[totalIndex] :
                    slider.options.items[totalIndex][indexes[1] * 1]

            // 如果点击的是当前item，执行相应事件（如果已设置）；如果不是当前元素则slide到对应item。
            if(slider.currentIndex === totalIndex){
                //如果有单独的事件，先执行。
                item && item.onClick && item.onClick.call(slider, e, item, li, totalIndex);
                //综合事件
                options.onItemClick && options.onItemClick.call(slider, e, item, totalIndex, li);

                returnValue = false;
            }else{
                //如果点击到的目标item不处在当前态，那么激活该item
                //TODO:这里暂时没想到好的办法，先用class hack一下。直接用slideTo(index)体验上有问题。
                //slider.slideTo(index);
                let clsList = li.classList;
                if(clsList.contains('righter')){
                    slider.slideToNext();
                }else if(clsList.contains('lefter')){
                    slider.slideToPrev();
                }
                returnValue = false;
            }

            // 如果设定为false,那么阻止默认行为和事件传递。
            if(!returnValue){
                e.preventDefault();
                e.stopPropagation();
            }
        });

        //如果需要导航栏，那么点击导航栏栏目，默认slide到对应item
        let navStyle = options.navStyle,
            navEle = elements.navigator;

        if(navStyle.type !== 'none'){

            // 点击导航栏选项，slide到对应的item主界面，（可选单击事件）
            elements.navigator.style.display = '';
            bindEvent(elements.navItems, 'click', 'a', function(e){
                let index = this.dataset["index"]*1,
                    navClickFn = options.onNavItemClick;
                // 如果定义了缩略图的点击事件，那么判断返回值是否显示的等于'false'，如果是那么阻止slide to target index page.
                if(typeof navClickFn === "function"){
                    let navItemClickReturnValue = navClickFn.call(null, e, options.items[index], index);
                    if(navItemClickReturnValue !== false){
                        slider.stop().slideTo(index);
                    }
                }else{
                    slider.stop().slideTo(index);
                }
                return false;
            });

            //【配置项】支持鼠标移到navigator上就立即slide到对应item上
            if(options.slideWhenHoverItem){
                let items = $all('a', elements.navItems),
                    _pre_status = '';
                bindEvent(items, 'mouseenter', function(){
                    _pre_status = slider.status;
                    let index = this.dataset["index"]*1;
                    slider.stop().slideTo(index);
                    return false;
                });
                bindEvent(items, 'mouseleave', function(){
                    //如果之前是播放状态，那么还原。
                    if(_pre_status === "playing"){
                        slider.run();
                    }
                    return false;
                });
            }

            //【配置项】导航栏区的左右箭头导航
            if(navStyle.showPrevAndNext){
                let _prev = elements.navPrevBtn,
                    _next = elements.navNextBtn;
                _prev.style.display = '';
                _next.style.display = '';

                //如果是自定义的导航区左右箭头事件，那么配置自定义事件
                let isCustomizeClickFunction = typeof options.onNavButtonClick === "function";
                bindEvent(_prev, 'click', function(e) {
                    if(isCustomizeClickFunction){
                        options.onNavButtonClick.call(slider, e, -1);
                    }else{
                        slider.slideToPrev();
                    }
                    e.preventDefault();
                    e.stopPropagation();
                });
                bindEvent(_next, 'click', function(e) {
                    if(isCustomizeClickFunction){
                        options.onNavButtonClick.call(slider, e, 1);
                    }else{
                        slider.slideToNext();
                    }
                    e.preventDefault();
                    e.stopPropagation();
                });
            }
        }

        //响应一下afterSlide事件，如果有的话。
        options.afterSlide && options.afterSlide.call(slider, options.items[currIndex], currIndex, currLi);
    }

    /**
     * 动态插入CSS工具方法
     * @param stylesheetCSString {String} <style>元素的内容
     */
    function insertStyleSheets(cssString){
        const prefix = '/**************** insert by slider *****************/';
        cssString = prefix + '\r\n' + cssString;
        let styleEle = $("#___slider_style");
        if(styleEle){
            styleEle.appendChild(document.createTextNode(cssString));
        }else{
            styleEle = document.createElement('style');
            styleEle.type = "text/css";
            styleEle.media = 'screen';
            styleEle.id = "___slider_style";
            styleEle.appendChild(document.createTextNode(cssString));
            $('head').appendChild(styleEle);
        }
    }

    /**
     * 查找单个元素（可以限定在某个容器下）， 作为jQuery $的替换方法。
     * @param queryString
     * @param scope
     * @returns {Element}
     */
    function $(queryString, scope){
        !(scope instanceof HTMLElement) && (scope = document);
        return scope.querySelector(queryString);
    }

    /**
     * 查找多个元素（可以限定在某个容器下）
     * @param queryString
     * @param scope
     * @returns {NodeList}
     */
    function $all(queryString, scope){
        !(scope instanceof HTMLElement) && (scope = document);
        return scope.querySelectorAll(queryString);
    }

    /**
     * 自定义的一个绑定事件的方法
     * @param {NodeList|Element} ele 要绑定事件的元素
     * @param {String} eName 事件名
     * @param {String} [agent] 代理dom的queryString， 可选.
     * @param {Function} fn 回调函数
     */
    function bindEvent(ele, eName, agent, fn){
        if(ele instanceof NodeList || ele instanceof HTMLCollection){
            //const args = Array.from(arguments);
            const args = [].slice.call(arguments, 0);
            [].forEach.call(ele, function(el){
                args[0] = el;
                bindEvent.apply(null, args);
            });
            return true;
        }
        //省略了agent参数的模式
        if(arguments.length === 3 && typeof agent === "function"){
            return bindEvent(ele, eName, null, agent);
        }
        ele.addEventListener(eName, function(e){
            // console.log(ele, eName, agent, fn)
            // 针对是否使用了代理分别处理
            if(agent){
                let target = e.target;
                while(ele.contains(target)){
                    if(target.matches(agent)){
                        let retturnValue = fn.call(target, e);
                        //只hack返回值绝对等于'false'。
                        if(retturnValue === false){
                            e.stopPropagation();
                            e.preventDefault();
                        }
                        return true;
                    }else{
                        target = target.parentElement;
                    }
                }
                //走到这里表示代理的元素没有找到，绑定失败。
                return false;
            }else{
                let retturnValue = fn.call(this, e);
                //只hack返回值绝对等于'false'。
                if(retturnValue === false){
                    e.stopPropagation();
                    e.preventDefault();
                }
                return true;
            }
        });
    }


    //------------------------------------------------------------------------------------------------
    //CommonJS mode:
    if(typeof module === "object" && typeof module.exports === "object"){
        module.exports = Slider;
    }else if(typeof define === "function" && (define.amd||define.cmd)){
        // AMD(RequireJS) and CMD(SeaJS) mode:
        define(function (require, exports, module) {
            return Slider;
        });
    }else{
        //normal script file load mode: <script src="***">
        window.StaticSlider = Slider;
    }
}(window, undefined);

// ES6 Module mode.
// export { Slider as StaticSlider };
