import findVersions = require('find-versions');
import * as _ from 'lodash';
import CircularProgress from 'material-ui/CircularProgress';
import {colors} from 'material-ui/styles';
import * as React from 'react';
import DocumentTitle = require('react-document-title');
import {
    scroller,
} from 'react-scroll';
import semverSort = require('semver-sort');
import {TopBar} from 'ts/components/top_bar';
import {Badge} from 'ts/components/ui/badge';
import {Comment} from 'ts/pages/documentation/comment';
import {DocsInfo} from 'ts/pages/documentation/docs_info';
import {EventDefinition} from 'ts/pages/documentation/event_definition';
import {MethodBlock} from 'ts/pages/documentation/method_block';
import {SourceLink} from 'ts/pages/documentation/source_link';
import {Type} from 'ts/pages/documentation/type';
import {TypeDefinition} from 'ts/pages/documentation/type_definition';
import {AnchorTitle} from 'ts/pages/shared/anchor_title';
import {MarkdownSection} from 'ts/pages/shared/markdown_section';
import {NestedSidebarMenu} from 'ts/pages/shared/nested_sidebar_menu';
import {SectionHeader} from 'ts/pages/shared/section_header';
import {Dispatcher} from 'ts/redux/dispatcher';
import {
    AddressByContractName,
    CustomType,
    DocAgnosticFormat,
    Docs,
    DocsInfoConfig,
    DoxityDocObj,
    EtherscanLinkSuffixes,
    Event,
    MenuSubsectionsBySection,
    Networks,
    Property,
    SolidityMethod,
    Styles,
    TypeDefinitionByName,
    WebsitePaths,
} from 'ts/types';
import {constants} from 'ts/utils/constants';
import {docUtils} from 'ts/utils/doc_utils';
import {doxityUtils} from 'ts/utils/doxity_utils';
import {utils} from 'ts/utils/utils';
/* tslint:disable:no-var-requires */
const IntroMarkdown = require('md/docs/smart_contracts/introduction');
/* tslint:enable:no-var-requires */

const SCROLL_TO_TIMEOUT = 500;
const SCROLL_TOP_ID = 'docsScrollTop';
const CUSTOM_PURPLE = '#690596';
const CUSTOM_RED = '#e91751';
const CUSTOM_TURQUOIS = '#058789';

const sections = constants.smartContractDocSections;

const docsInfoConfig: DocsInfoConfig = {
    packageName: '0x Smart Contracts',
    packageUrl: 'https://github.com/0xProject/contracts',
    websitePath: WebsitePaths.SmartContracts,
    docsJsonRoot: 'https://s3.amazonaws.com/smart-contracts-docs-json',
    menu: {
        introduction: [
            sections.Introduction,
        ],
        contracts: [
            sections.Exchange,
            sections.TokenRegistry,
            sections.ZRXToken,
            sections.EtherToken,
            sections.TokenTransferProxy,
        ],
    },
    sectionNameToMarkdown: {
        [sections.Introduction]: IntroMarkdown,
    },
    sections,
};

const networkNameToColor: {[network: string]: string} = {
    [Networks.kovan]: CUSTOM_PURPLE,
    [Networks.ropsten]: CUSTOM_RED,
    [Networks.mainnet]: CUSTOM_TURQUOIS,
};

export interface SmartContractsDocumentationAllProps {
    source: string;
    location: Location;
    dispatcher: Dispatcher;
    docsVersion: string;
    availableDocVersions: string[];
}

interface SmartContractsDocumentationState {
    docAgnosticFormat?: DocAgnosticFormat;
}

const styles: Styles = {
    mainContainers: {
        position: 'absolute',
        top: 60,
        left: 0,
        bottom: 0,
        right: 0,
        overflowZ: 'hidden',
        overflowY: 'scroll',
        minHeight: 'calc(100vh - 60px)',
        WebkitOverflowScrolling: 'touch',
    },
    menuContainer: {
        borderColor: colors.grey300,
        maxWidth: 330,
        marginLeft: 20,
    },
};
const docsInfo = new DocsInfo(docsInfoConfig);

export class SmartContractsDocumentation extends
    React.Component<SmartContractsDocumentationAllProps, SmartContractsDocumentationState> {
    constructor(props: SmartContractsDocumentationAllProps) {
        super(props);
        this.state = {
            docAgnosticFormat: undefined,
        };
    }
    public componentWillMount() {
        const pathName = this.props.location.pathname;
        const lastSegment = pathName.substr(pathName.lastIndexOf('/') + 1);
        const versions = findVersions(lastSegment);
        const preferredVersionIfExists = versions.length > 0 ? versions[0] : undefined;
        // tslint:disable-next-line:no-floating-promises
        this.fetchJSONDocsFireAndForgetAsync(preferredVersionIfExists);
    }
    public render() {
        const menuSubsectionsBySection = _.isUndefined(this.state.docAgnosticFormat)
                                         ? {}
                                         : this.getMenuSubsectionsBySection(this.state.docAgnosticFormat);
        return (
            <div>
                <DocumentTitle title="0x Smart Contract Documentation"/>
                <TopBar
                    blockchainIsLoaded={false}
                    location={this.props.location}
                    docsVersion={this.props.docsVersion}
                    availableDocVersions={this.props.availableDocVersions}
                    menu={docsInfo.getMenu(this.props.docsVersion)}
                    menuSubsectionsBySection={menuSubsectionsBySection}
                    shouldFullWidth={true}
                    docPath={docsInfo.websitePath}
                />
                {_.isUndefined(this.state.docAgnosticFormat) ?
                    <div
                        className="col col-12"
                        style={styles.mainContainers}
                    >
                        <div
                            className="relative sm-px2 sm-pt2 sm-m1"
                            style={{height: 122, top: '50%', transform: 'translateY(-50%)'}}
                        >
                            <div className="center pb2">
                                <CircularProgress size={40} thickness={5} />
                            </div>
                            <div className="center pt2" style={{paddingBottom: 11}}>Loading documentation...</div>
                        </div>
                    </div> :
                    <div
                        className="mx-auto flex"
                        style={{color: colors.grey800, height: 43}}
                    >
                        <div className="relative col md-col-3 lg-col-3 lg-pl0 md-pl1 sm-hide xs-hide">
                            <div
                                className="border-right absolute"
                                style={{...styles.menuContainer, ...styles.mainContainers}}
                            >
                                <NestedSidebarMenu
                                    selectedVersion={this.props.docsVersion}
                                    versions={this.props.availableDocVersions}
                                    topLevelMenu={docsInfo.getMenu()}
                                    menuSubsectionsBySection={menuSubsectionsBySection}
                                    docPath={docsInfo.websitePath}
                                />
                            </div>
                        </div>
                        <div className="relative col lg-col-9 md-col-9 sm-col-12 col-12">
                            <div
                                id="documentation"
                                style={styles.mainContainers}
                                className="absolute"
                            >
                                <div id={SCROLL_TOP_ID} />
                                <h1 className="md-pl2 sm-pl3">
                                    <a href={constants.GITHUB_CONTRACTS_URL} target="_blank">
                                        0x Smart Contracts
                                    </a>
                                </h1>
                                {this.renderDocumentation()}
                            </div>
                        </div>
                    </div>
                }
            </div>
        );
    }
    private renderDocumentation(): React.ReactNode {
        const subMenus = _.values(docsInfo.getMenu());
        const orderedSectionNames = _.flatten(subMenus);
        // Since smart contract method params are all base types, no need to pass
        // down the typeDefinitionByName
        const typeDefinitionByName = {};
        const renderedSections = _.map(orderedSectionNames, this.renderSection.bind(this, typeDefinitionByName));

        return renderedSections;
    }
    private renderSection(typeDefinitionByName: TypeDefinitionByName, sectionName: string): React.ReactNode {
        const docSection = this.state.docAgnosticFormat[sectionName];

        const markdownFileIfExists = docsInfo.sectionNameToMarkdown[sectionName];
        if (!_.isUndefined(markdownFileIfExists)) {
            return (
                <MarkdownSection
                    key={`markdown-section-${sectionName}`}
                    sectionName={sectionName}
                    markdownContent={markdownFileIfExists}
                />
            );
        }

        if (_.isUndefined(docSection)) {
            return null;
        }

        const sortedProperties = _.sortBy(docSection.properties, 'name');
        const propertyDefs = _.map(sortedProperties, this.renderProperty.bind(this));

        const sortedMethods = _.sortBy(docSection.methods, 'name');
        const methodDefs = _.map(sortedMethods, method => {
            const isConstructor = false;
            return this.renderMethodBlocks(method, sectionName, isConstructor, typeDefinitionByName);
        });

        const sortedEvents = _.sortBy(docSection.events, 'name');
        const eventDefs = _.map(sortedEvents, (event: Event, i: number) => {
            return (
                <EventDefinition
                    key={`event-${event.name}-${i}`}
                    event={event}
                    docsInfo={docsInfo}
                />
            );
        });
        return (
            <div
                key={`section-${sectionName}`}
                className="py2 pr3 md-pl2 sm-pl3"
            >
                <div className="flex">
                        <div style={{marginRight: 7}}>
                            <SectionHeader sectionName={sectionName} />
                        </div>
                        {this.renderNetworkBadges(sectionName)}
                </div>
                {docSection.comment &&
                    <Comment
                        comment={docSection.comment}
                    />
                }
                {docSection.constructors.length > 0 &&
                    <div>
                        <h2 className="thin">Constructor</h2>
                        {this.renderConstructors(docSection.constructors, typeDefinitionByName)}
                    </div>
                }
                {docSection.properties.length > 0 &&
                    <div>
                        <h2 className="thin">Properties</h2>
                        <div>{propertyDefs}</div>
                    </div>
                }
                {docSection.methods.length > 0 &&
                    <div>
                        <h2 className="thin">Methods</h2>
                        <div>{methodDefs}</div>
                    </div>
                }
                {docSection.events.length > 0 &&
                    <div>
                        <h2 className="thin">Events</h2>
                        <div>{eventDefs}</div>
                    </div>
                }
            </div>
        );
    }
    private renderNetworkBadges(sectionName: string) {
        const networkToAddressByContractName = constants.contractAddresses[this.props.docsVersion];
        const badges = _.map(networkToAddressByContractName,
            (addressByContractName: AddressByContractName, networkName: string) => {
                const contractAddress = addressByContractName[sectionName];
                const linkIfExists = utils.getEtherScanLinkIfExists(
                    contractAddress, constants.networkIdByName[networkName], EtherscanLinkSuffixes.address,
                );
                return (
                    <a
                        key={`badge-${networkName}-${sectionName}`}
                        href={linkIfExists}
                        target="_blank"
                        style={{color: 'white', textDecoration: 'none'}}
                    >
                        <Badge
                            title={networkName}
                            backgroundColor={networkNameToColor[networkName]}
                        />
                    </a>
                );
        });
        return badges;
    }
    private renderConstructors(constructors: SolidityMethod[],
                               typeDefinitionByName: TypeDefinitionByName): React.ReactNode {
        const constructorDefs = _.map(constructors, constructor => {
            return this.renderMethodBlocks(
                constructor, docsInfo.sections.zeroEx, constructor.isConstructor, typeDefinitionByName,
            );
        });
        return (
            <div>
                {constructorDefs}
            </div>
        );
    }
    private renderProperty(property: Property): React.ReactNode {
        return (
            <div
                key={`property-${property.name}-${property.type.name}`}
                className="pb3"
            >
                <code className="hljs">
                    {property.name}: <Type type={property.type} docsInfo={docsInfo} />
                </code>
                {property.source &&
                    <SourceLink
                        version={this.props.docsVersion}
                        source={property.source}
                        baseUrl={docsInfo.packageUrl}
                    />
                }
                {property.comment &&
                    <Comment
                        comment={property.comment}
                        className="py2"
                    />
                }
            </div>
        );
    }
    private renderMethodBlocks(method: SolidityMethod, sectionName: string, isConstructor: boolean,
                               typeDefinitionByName: TypeDefinitionByName): React.ReactNode {
        return (
            <MethodBlock
               key={`method-${method.name}`}
               method={method}
               typeDefinitionByName={typeDefinitionByName}
               libraryVersion={this.props.docsVersion}
               docsInfo={docsInfo}
            />
        );
    }
    private scrollToHash(): void {
        const hashWithPrefix = this.props.location.hash;
        let hash = hashWithPrefix.slice(1);
        if (_.isEmpty(hash)) {
            hash = SCROLL_TOP_ID; // scroll to the top
        }

        scroller.scrollTo(hash, {duration: 0, offset: 0, containerId: 'documentation'});
    }
    private getMenuSubsectionsBySection(docAgnosticFormat?: DocAgnosticFormat): MenuSubsectionsBySection {
        const menuSubsectionsBySection = {} as MenuSubsectionsBySection;
        if (_.isUndefined(docAgnosticFormat)) {
            return menuSubsectionsBySection;
        }

        const docSections = _.keys(docsInfo.sections);
        _.each(docSections, sectionName => {
            const docSection = docAgnosticFormat[sectionName];
            if (_.isUndefined(docSection)) {
                return; // no-op
            }

            if (sectionName === docsInfo.sections.types) {
                const sortedTypesNames = _.sortBy(docSection.types, 'name');
                const typeNames = _.map(sortedTypesNames, t => t.name);
                menuSubsectionsBySection[sectionName] = typeNames;
            } else {
                const sortedEventNames = _.sortBy(docSection.events, 'name');
                const eventNames = _.map(sortedEventNames, m => m.name);
                const sortedMethodNames = _.sortBy(docSection.methods, 'name');
                const methodNames = _.map(sortedMethodNames, m => m.name);
                menuSubsectionsBySection[sectionName] = [...methodNames, ...eventNames];
            }
        });
        return menuSubsectionsBySection;
    }
    private async fetchJSONDocsFireAndForgetAsync(preferredVersionIfExists?: string): Promise<void> {
        const versionToFileName = await docUtils.getVersionToFileNameAsync(docsInfo.docsJsonRoot);
        const versions = _.keys(versionToFileName);
        this.props.dispatcher.updateAvailableDocVersions(versions);
        const sortedVersions = semverSort.desc(versions);
        const latestVersion = sortedVersions[0];

        let versionToFetch = latestVersion;
        if (!_.isUndefined(preferredVersionIfExists)) {
            const preferredVersionFileNameIfExists = versionToFileName[preferredVersionIfExists];
            if (!_.isUndefined(preferredVersionFileNameIfExists)) {
                versionToFetch = preferredVersionIfExists;
            }
        }
        this.props.dispatcher.updateCurrentDocsVersion(versionToFetch);

        const versionFileNameToFetch = versionToFileName[versionToFetch];
        const versionDocObj = await docUtils.getJSONDocFileAsync(versionFileNameToFetch, docsInfo.docsJsonRoot);
        const docAgnosticFormat = doxityUtils.convertToDocAgnosticFormat(versionDocObj as DoxityDocObj);

        this.setState({
            docAgnosticFormat,
        }, () => {
            this.scrollToHash();
        });
    }
}
