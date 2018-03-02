import * as _ from 'lodash';
import * as React from 'react';
import { configs } from 'ts/utils/configs';
import { utils } from 'ts/utils/utils';

interface MarkdownLinkBlockProps {
    href: string;
}

interface MarkdownLinkBlockState {}

export class MarkdownLinkBlock extends React.Component<MarkdownLinkBlockProps, MarkdownLinkBlockState> {
    // Re-rendering a linkBlock causes any use selection to become de-selected making the link unclickable.
    // We therefore noop re-renders on this component if it's props haven't changed.
    public shouldComponentUpdate(nextProps: MarkdownLinkBlockProps, nextState: MarkdownLinkBlockState) {
        return nextProps.href !== this.props.href;
    }
    public render() {
        const href = this.props.href;
        // If protocol is http or https, we can open in a new tab, otherwise don't for security reasons
        if (_.startsWith(href, 'http') || _.startsWith(href, 'https')) {
            return (
                <a href={href} target="_blank" rel="nofollow noreferrer noopener">
                    {this.props.children}
                </a>
            );
        } else if (_.startsWith(href, '#')) {
            return (
                <a style={{ cursor: 'pointer' }} onClick={this._onHashUrlClick.bind(this, href)}>
                    {this.props.children}
                </a>
            );
        } else {
            return <a href={href}>{this.props.children}</a>;
        }
    }
    private _onHashUrlClick(href: string) {
        const hashWithPrefix = `#${href.split('#')[1]}`;
        utils.scrollToHash(hashWithPrefix, configs.SCROLL_CONTAINER_ID);
    }
}
