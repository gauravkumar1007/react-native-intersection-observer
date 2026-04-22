import React, { createRef, forwardRef, PureComponent } from 'react';
import { findNodeHandle, View } from 'react-native';
import IOContext from './IOContext';
import IOManager from './IOManager';

function withIO(Comp, methods) {
    class IOScrollableComponent extends PureComponent {
        nativeRef;
        scroller;
        root;
        manager;
        contextValue;

        constructor(props) {
            super(props);

            const self = this;
            this.scroller = createRef();
            this.nativeRef = createRef();
            this.root = {
                get node() {
                    return self.nativeRef.current;
                },
                get horizontal() {
                    return !!self.props.horizontal;
                },
                current: {
                    contentInset: {
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                    },
                    contentOffset: {
                        x: 0,
                        y: 0,
                    },
                    contentSize: {
                        width: 0,
                        height: 0,
                    },
                    layoutMeasurement: {
                        width: 0,
                        height: 0,
                    },
                    zoomScale: 1,
                },
            };

            const manager = new IOManager({
                root: this.root,
                get rootMargin() {
                    return self.props.rootMargin;
                },
            });

            this.manager = manager;
            this.contextValue = {
                manager,
            };

            methods.forEach((method) => {
                this[method] = (...args) => {
                    this.scroller.current?.[method]?.(...args);
                };
            });

            // Forward the outer ref (including Animated.createAnimatedComponent's
            // merged ref) to the real FlatList/ScrollView so native scroll events
            // attach to the scroll view, not the IO wrapper instance.
            this.captureScrollerRef = (node) => {
                this.scroller.current = node;
                const outerRef = this.props.forwardedRef;
                if (typeof outerRef === 'function') {
                    outerRef(node);
                } else if (outerRef != null) {
                    outerRef.current = node;
                }
            };
        }

        componentDidMount() {
            this.nativeNode = findNodeHandle(this.nativeRef.current);
        }

        handleContentSizeChange = (width, height) => {
            const { contentSize } = this.root.current;

            if (width !== contentSize.width || height !== contentSize.height) {
                this.root.current.contentSize = { width, height };
                if (width > 0 && height > 0 && this.root.onLayout) {
                    this.root.onLayout();
                }
            }

            const { onContentSizeChange } = this.props;
            if (onContentSizeChange) {
                onContentSizeChange(width, height);
            }
        };

        handleLayout = (event) => {
            const {
                nativeEvent: { layout },
            } = event;
            const { layoutMeasurement } = this.root.current;

            if (layoutMeasurement.width !== layout.width || layoutMeasurement.height !== layout.height) {
                this.root.current.layoutMeasurement = layout;
            }

            const { onLayout } = this.props;
            if (onLayout) {
                onLayout(event);
            }
        };

        handleScroll = (event) => {
            this.root.current = event.nativeEvent;

            if (this.root.onScroll) {
                this.root.onScroll(this.root.current);
            }

            const { onScroll } = this.props;
            if (onScroll) {
                onScroll(event);
            }
        };

        render() {
            const { forwardedRef, ...restProps } = this.props;

            return (
                <IOContext.Provider value={this.contextValue}>
                    <View ref={this.nativeRef} collapsable={false}>
                        <Comp
                            scrollEventThrottle={16}
                            {...restProps}
                            ref={this.captureScrollerRef}
                            onContentSizeChange={this.handleContentSizeChange}
                            onLayout={this.handleLayout}
                            onScroll={this.handleScroll}
                        />
                    </View>
                </IOContext.Provider>
            );
        }
    }

    const ForwardedIO = forwardRef((props, ref) => <IOScrollableComponent {...props} forwardedRef={ref} />);

    const name = Comp.displayName || Comp.name || 'Scrollable';
    ForwardedIO.displayName = `IO(${name})`;

    return ForwardedIO;
}

export default withIO;
